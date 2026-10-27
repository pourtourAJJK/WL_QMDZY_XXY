"""登录失败记录：服务端锁定状态（替代前端 localStorage 锁定）。"""
from datetime import timedelta

from django.db import models
from django.utils import timezone

MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION = timedelta(minutes=5)


class LoginAttempt(models.Model):
    """按账号记录连续失败次数与锁定截止时间，锁定状态只存在于服务端。"""

    username = models.CharField(max_length=150, unique=True, verbose_name="账号")
    failed_attempts = models.PositiveIntegerField(default=0, verbose_name="连续失败次数")
    locked_until = models.DateTimeField(null=True, blank=True, verbose_name="锁定截止时间")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "登录失败记录"
        verbose_name_plural = "登录失败记录"

    def remaining_lock_seconds(self) -> int:
        """剩余锁定秒数（向上取整，0 表示未锁定）。"""
        if not self.locked_until:
            return 0
        remain = (self.locked_until - timezone.now()).total_seconds()
        return max(0, int(remain) + 1)

    def is_locked(self) -> bool:
        return self.remaining_lock_seconds() > 0

    def refresh_lock(self) -> int:
        """返回剩余锁定秒数；若锁定期已过则清零失败计数。"""
        remaining = self.remaining_lock_seconds()
        if self.locked_until and remaining == 0:
            self.failed_attempts = 0
            self.locked_until = None
            self.save(update_fields=["failed_attempts", "locked_until", "updated_at"])
        return remaining

    def register_failure(self) -> None:
        """累计一次失败；达到阈值即锁定 5 分钟。"""
        if self.refresh_lock():
            return
        self.failed_attempts += 1
        if self.failed_attempts >= MAX_FAILED_ATTEMPTS:
            self.locked_until = timezone.now() + LOCK_DURATION
        self.save(update_fields=["failed_attempts", "locked_until", "updated_at"])

    def reset(self) -> None:
        """登录成功后清除失败计数与锁定。"""
        if self.failed_attempts or self.locked_until:
            self.failed_attempts = 0
            self.locked_until = None
            self.save(update_fields=["failed_attempts", "locked_until", "updated_at"])

    def __str__(self):
        return f"{self.username} (failed={self.failed_attempts})"
