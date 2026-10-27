from django.contrib import admin

from .models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("date", "category", "amount", "user")
    list_filter = ("category", "date")
    search_fields = ("note", "category")
