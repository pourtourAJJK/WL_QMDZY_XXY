"""认证接口：注册 / 登录（JWT + 服务端锁定）/ 当前用户 / 登出（拉黑 refresh）。"""
from django.contrib.auth import authenticate, get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from .models import MAX_FAILED_ATTEMPTS, LoginAttempt
from .serializers import LoginSerializer, RegisterSerializer

User = get_user_model()


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"username": user.username, "detail": "注册成功，请登录"},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"].strip()
        password = serializer.validated_data["password"]

        # 不存在的账号直接按通用错误返回，且不落库，避免脏数据堆积
        if not User.objects.filter(username=username).exists():
            return Response(
                {"detail": "账号或密码错误", "remaining_attempts": MAX_FAILED_ATTEMPTS - 1},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        attempt, _ = LoginAttempt.objects.get_or_create(username=username)
        locked_seconds = attempt.refresh_lock()
        if locked_seconds:
            return Response(
                {"detail": "账号已锁定，请稍后重试", "retry_after": locked_seconds},
                status=status.HTTP_423_LOCKED,
            )

        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            attempt.register_failure()
            locked_seconds = attempt.remaining_lock_seconds()
            if locked_seconds:
                return Response(
                    {"detail": "密码错误次数过多，账号已锁定", "retry_after": locked_seconds},
                    status=status.HTTP_423_LOCKED,
                )
            left = max(0, MAX_FAILED_ATTEMPTS - attempt.failed_attempts)
            return Response(
                {"detail": "账号或密码错误", "remaining_attempts": left},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        attempt.reset()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "username": user.username,
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "username": user.username,
                "date_joined": user.date_joined.isoformat(),
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = (request.data or {}).get("refresh")
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except TokenError:
                # 令牌无效或已过期：登出仍然视为成功
                pass
        return Response(status=status.HTTP_205_RESET_CONTENT)
