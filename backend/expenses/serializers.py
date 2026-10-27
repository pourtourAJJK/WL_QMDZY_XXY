"""开销序列化：金额统一输出为浮点，便于前端图表直接计算。"""
from decimal import Decimal

from rest_framework import serializers

from .models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    amount = serializers.FloatField(min_value=0.01, max_value=100000000)

    class Meta:
        model = Expense
        fields = ["id", "amount", "category", "date", "note", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_category(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("类别不能为空")
        return value[:32]

    def validate_note(self, value):
        value = (value or "").strip()
        if len(value) > 100:
            raise serializers.ValidationError("备注不能超过 100 字")
        return value

    def validate_amount(self, value):
        if Decimal(str(value)) <= 0:
            raise serializers.ValidationError("金额必须大于 0")
        return value
