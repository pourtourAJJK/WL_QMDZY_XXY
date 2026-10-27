from django.urls import path

from .views import (
    ExpenseClearView,
    ExpenseDetailView,
    ExpenseExportView,
    ExpenseImportView,
    ExpenseListCreateView,
)

urlpatterns = [
    path("", ExpenseListCreateView.as_view(), name="expense-list"),
    path("clear/", ExpenseClearView.as_view(), name="expense-clear"),
    path("import/", ExpenseImportView.as_view(), name="expense-import"),
    path("export/", ExpenseExportView.as_view(), name="expense-export"),
    path("<uuid:id>/", ExpenseDetailView.as_view(), name="expense-detail"),
]
