"""注册/登录参数校验。密码只以 PBKDF2 哈希落库，绝不回传。"""
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()

USERNAME_PATTERN = re.compile(r"^[\w.@+-]{3,150}$")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    password = serializers.CharField(
        min_length=6, max_length=128, write_only=True, trim_whitespace=False
    )

    def validate_username(self, value):
        value = (value or "").strip()
        if not USERNAME_PATTERN.match(value):
            raise serializers.ValidationError("账号需为 3-150 位字母、数字或 _ . @ + -")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("该账号已存在")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        # create_user 内部使用 PBKDF2-SHA256 + 随机盐
        return User.objects.create_user(
            username=validated_data["username"], password=validated_data["password"]
        )


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)
