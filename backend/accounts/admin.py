from django.contrib import admin

from .models import LoginAttempt


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("username", "failed_attempts", "locked_until", "updated_at")
    search_fields = ("username",)
