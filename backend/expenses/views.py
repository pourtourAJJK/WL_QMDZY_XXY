"""开销接口：列表/新增/删除/清空/文件导入，全部要求 JWT 且按用户隔离。"""
from django.db import transaction
from rest_framework import generics, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .importers import ImportValidationError, parse_upload
from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return self.request.user.expenses.all()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExpenseDetailView(generics.DestroyAPIView):
    lookup_field = "id"
    serializer_class = ExpenseSerializer

    def get_queryset(self):
        return self.request.user.expenses.all()


class ExpenseClearView(APIView):
    def delete(self, request):
        deleted, _ = request.user.expenses.all().delete()
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)


class ExpenseImportView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "import"

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"detail": "请选择要导入的文件"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            records = parse_upload(upload.name, upload.read())
        except ImportValidationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            request.user.expenses.all().delete()
            Expense.objects.bulk_create(
                [Expense(user=request.user, **record) for record in records]
            )
        return Response({"imported": len(records)}, status=status.HTTP_200_OK)
