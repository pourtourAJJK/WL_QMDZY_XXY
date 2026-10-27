"""统一 API 错误响应：{detail, retry_after?, remaining_attempts?, errors?}。"""
from rest_framework.views import exception_handler

_EXTRA_KEYS = ("retry_after", "remaining_attempts", "failed_attempts", "locked_until")


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    payload = {}
    if isinstance(data, dict) and "detail" in data:
        payload["detail"] = str(data["detail"])
    else:
        payload["detail"] = "请求参数有误"
        payload["errors"] = data

    if isinstance(data, dict):
        for key in _EXTRA_KEYS:
            if key in data:
                payload[key] = data[key]

    response.data = payload
    return response
