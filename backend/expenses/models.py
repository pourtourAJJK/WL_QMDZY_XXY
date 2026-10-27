"""开销记录（按用户隔离，UUID 主键）。"""
import uuid

from django.conf import settings
from django.db import models


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expenses"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="金额")
    category = models.CharField(max_length=32, verbose_name="类别")
    date = models.DateField(verbose_name="日期")
    note = models.CharField(max_length=100, blank=True, default="", verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        verbose_name = "开销记录"
        verbose_name_plural = "开销记录"
        indexes = [models.Index(fields=["user", "-date"])]

    def __str__(self):
        return f"{self.date} {self.category} {self.amount}"
