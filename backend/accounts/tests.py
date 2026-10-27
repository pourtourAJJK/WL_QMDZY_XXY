"""认证安全测试：PBKDF2 哈希、JWT、服务端锁定、限流、令牌拉黑。"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import LoginAttempt

User = get_user_model()


class AuthTestBase(APITestCase):
    def setUp(self):
        cache.clear()
        self.register_url = reverse("auth-register")
        self.login_url = reverse("auth-login")
        self.me_url = reverse("auth-me")
        self.logout_url = reverse("auth-logout")
        self.refresh_url = reverse("auth-refresh")

    def register(self, username="alice", password="secret123"):
        return self.client.post(
            self.register_url,
            {"username": username, "password": password},
            format="json",
        )

    def login(self, username="alice", password="secret123"):
        return self.client.post(
            self.login_url, {"username": username, "password": password}, format="json"
        )

    def bearer(self, token):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


class RegisterTests(AuthTestBase):
    def test_register_hashes_password_with_pbkdf2_and_salt(self):
        response = self.register()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(username="alice")
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))
        self.assertNotIn("secret123", user.password)
        # pbkdf2_sha256$iterations$salt$hash —— 盐段必须存在且非空
        salt = user.password.split("$")[2]
        self.assertGreaterEqual(len(salt), 8)

        # 同一密码两次注册（不同用户）哈希必须不同，证明盐随机
        self.register(username="bob", password="secret123")
        self.assertNotEqual(user.password, User.objects.get(username="bob").password)

    def test_register_rejects_duplicate_username(self):
        self.register()
        response = self.register(username="ALICE")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("该账号已存在", response.data["detail"] + str(response.data.get("errors", "")))

    def test_register_rejects_short_password(self):
        response = self.register(password="123")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginTests(AuthTestBase):
    def setUp(self):
        super().setUp()
        self.register()

    def test_login_returns_jwt_and_me_works(self):
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["username"], "alice")

        me = self.client.get(self.me_url, **self.bearer(response.data["access"]))
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["username"], "alice")

    def test_me_requires_token(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_forged_token_rejected(self):
        response = self.client.get(self.me_url, **self.bearer("forged.token.value"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh_token(self):
        tokens = self.login().data
        logout = self.client.post(
            self.logout_url,
            {"refresh": tokens["refresh"]},
            format="json",
            **self.bearer(tokens["access"]),
        )
        self.assertEqual(logout.status_code, status.HTTP_205_RESET_CONTENT)

        refreshed = self.client.post(
            self.refresh_url, {"refresh": tokens["refresh"]}, format="json"
        )
        self.assertEqual(refreshed.status_code, status.HTTP_401_UNAUTHORIZED)


class LockoutTests(AuthTestBase):
    def setUp(self):
        super().setUp()
        self.register()

    def test_five_failures_lock_account_server_side(self):
        for attempt_no in range(1, 6):
            response = self.login(password="wrong-pass")
            # 前 4 次为普通 401，第 5 次达到阈值直接锁定（423）
            expected = (
                status.HTTP_401_UNAUTHORIZED
                if attempt_no < 5
                else status.HTTP_423_LOCKED
            )
            self.assertEqual(response.status_code, expected)

        # 锁定后即使密码正确也必须被拒绝
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_423_LOCKED)
        self.assertGreater(response.data["retry_after"], 0)

        attempt = LoginAttempt.objects.get(username="alice")
        self.assertIsNotNone(attempt.locked_until)
        self.assertGreater(attempt.locked_until, timezone.now())

    def test_lock_state_is_independent_between_accounts(self):
        self.register(username="bob", password="secret123")
        for _ in range(5):
            self.login(password="wrong-pass")

        self.assertEqual(self.login().status_code, status.HTTP_423_LOCKED)
        self.assertEqual(self.login(username="bob").status_code, status.HTTP_200_OK)

    def test_lock_expires_after_five_minutes(self):
        for _ in range(5):
            self.login(password="wrong-pass")

        LoginAttempt.objects.filter(username="alice").update(
            locked_until=timezone.now() - timedelta(seconds=1)
        )
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        attempt = LoginAttempt.objects.get(username="alice")
        self.assertEqual(attempt.failed_attempts, 0)
        self.assertIsNone(attempt.locked_until)

    def test_successful_login_resets_failure_counter(self):
        for _ in range(3):
            self.login(password="wrong-pass")
        self.assertEqual(self.login().status_code, status.HTTP_200_OK)
        self.assertEqual(LoginAttempt.objects.get(username="alice").failed_attempts, 0)

    def test_unknown_username_returns_generic_error(self):
        response = self.login(username="nobody")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["detail"], "账号或密码错误")
        # 不存在的账号不应产生锁定记录（避免脏数据堆积）
        self.assertFalse(LoginAttempt.objects.filter(username="nobody").exists())


class ThrottleTests(AuthTestBase):
    def setUp(self):
        super().setUp()
        self.register()

    def test_login_endpoint_is_rate_limited(self):
        """DRF 的 THROTTLE_RATES 在模块导入时绑定为类属性，故测试内直接临时替换。"""
        from rest_framework.throttling import ScopedRateThrottle

        cache.clear()
        original = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {**original, "login": "2/min"}
        try:
            codes = [self.login(password="wrong-pass").status_code for _ in range(3)]
        finally:
            ScopedRateThrottle.THROTTLE_RATES = original

        self.assertEqual(codes[:2], [status.HTTP_401_UNAUTHORIZED] * 2)
        self.assertEqual(codes[2], status.HTTP_429_TOO_MANY_REQUESTS)
