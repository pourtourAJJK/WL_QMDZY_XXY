"""服务端导入解析（JSON / CSV / XLSX）。

安全要点：
- 大小上限 5MB、行数上限 5000，超限直接拒绝；
- 逐行校验金额（>0）、日期、类别、备注长度，任一行不合法则整份文件拒绝；
- 只接受 .xlsx（旧版 .xls 需另存），避免引入不安全的旧格式解析器；
- 解析与写入在事务中完成，失败不会破坏用户既有数据。
"""
import csv
import io
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import openpyxl

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000

_FIELD_ALIASES = {
    "amount": {"amount", "金额"},
    "category": {"category", "类别"},
    "date": {"date", "日期"},
    "note": {"note", "备注"},
}

# 无表头时按现有导出顺序：id, date, category, amount, note, created_at
_POSITIONAL_INDEX = {"date": 1, "category": 2, "amount": 3, "note": 4}

_DATE_FORMATS = ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S")


class ImportValidationError(Exception):
    """文件内容不合法（对外返回 400）。"""


def parse_upload(filename: str, raw: bytes) -> list[dict]:
    """按扩展名分派解析，返回已归一化并通过校验的记录列表。"""
    if not raw:
        raise ImportValidationError("文件为空")
    if len(raw) > MAX_FILE_BYTES:
        raise ImportValidationError("文件超过 5MB 上限")

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "json":
        records = _parse_json(raw)
    elif ext in ("csv", "txt"):
        records = _parse_csv(raw)
    elif ext == "xlsx":
        records = _parse_xlsx(raw)
    elif ext == "xls":
        raise ImportValidationError("暂不支持旧版 .xls，请用 Excel 另存为 .xlsx 后重试")
    else:
        raise ImportValidationError("仅支持 .json / .csv / .xlsx 文件")

    if not records:
        raise ImportValidationError("文件中没有可导入的数据")
    if len(records) > MAX_ROWS:
        raise ImportValidationError(f"单次最多导入 {MAX_ROWS} 条记录")
    return records


# ============ 各格式解析 ============

def _parse_json(raw: bytes) -> list[dict]:
    try:
        data = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ImportValidationError(f"JSON 解析失败：{exc}") from exc

    if isinstance(data, dict):
        data = data.get("expenses")
    if not isinstance(data, list):
        raise ImportValidationError("JSON 需为数组，或包含 expenses 数组的对象")

    records = []
    for idx, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ImportValidationError(f"JSON 第 {idx} 条记录不是对象")
        records.append(_normalize(item.get("amount"), item.get("date"), item.get("category"), item.get("note"), idx, "JSON"))
    return records


def _parse_csv(raw: bytes) -> list[dict]:
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ImportValidationError("CSV 需为 UTF-8 编码") from exc

    rows = list(csv.reader(io.StringIO(text)))
    rows = [r for r in rows if any(str(c).strip() for c in r)]
    if not rows:
        raise ImportValidationError("CSV 文件为空")

    index = _build_index(rows[0])
    if index is None:
        if not _looks_like_data_row(rows[0]):
            raise ImportValidationError("CSV 缺少表头，且首行不是数据行（需包含 金额/amount 列）")
        index, data_rows = _POSITIONAL_INDEX, rows
    else:
        data_rows = rows[1:]

    records = []
    for offset, row in enumerate(data_rows, start=1):
        if not any(str(c).strip() for c in row):
            continue
        records.append(
            _normalize(
                _cell(row, index, "amount"),
                _cell(row, index, "date"),
                _cell(row, index, "category"),
                _cell(row, index, "note"),
                offset,
                "CSV",
            )
        )
    return records


def _parse_xlsx(raw: bytes) -> list[dict]:
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    except Exception as exc:  # openpyxl 对损坏文件抛出多种异常
        raise ImportValidationError("Excel 文件损坏或不是 .xlsx 格式") from exc

    sheet = workbook[workbook.sheetnames[0]]
    rows = [[c for c in row] for row in sheet.iter_rows(values_only=True)]
    workbook.close()
    rows = [r for r in rows if any(str(c).strip() for c in r if c is not None)]
    if not rows:
        raise ImportValidationError("Excel 工作表为空")

    index = _build_index(rows[0])
    if index is None:
        index, data_rows = _POSITIONAL_INDEX, rows
    else:
        data_rows = rows[1:]

    records = []
    for offset, row in enumerate(data_rows, start=1):
        records.append(
            _normalize(
                _cell(row, index, "amount"),
                _cell(row, index, "date"),
                _cell(row, index, "category"),
                _cell(row, index, "note"),
                offset,
                "Excel",
            )
        )
    return records


# ============ 通用工具 ============

def _build_index(header) -> dict | None:
    index = {}
    for idx, cell in enumerate(header):
        key = str(cell or "").strip().lower()
        for field, aliases in _FIELD_ALIASES.items():
            if key in aliases:
                index[field] = idx
    if not {"amount", "date", "category"}.issubset(index):
        return None
    return index


def _looks_like_data_row(row) -> bool:
    try:
        Decimal(str(row[_POSITIONAL_INDEX["amount"]]).replace(",", "").strip())
        return True
    except (InvalidOperation, IndexError):
        return False


def _cell(row, index: dict, field: str):
    i = index.get(field)
    if i is None or i >= len(row):
        return None
    return row[i]


def _normalize(amount, date_value, category, note, row_no: int, source: str) -> dict:
    if isinstance(amount, str):
        amount = amount.replace(",", "").replace("¥", "").strip()
    try:
        amount_dec = Decimal(str(amount))
    except (InvalidOperation, TypeError):
        raise ImportValidationError(f"{source} 第 {row_no} 行：金额不是有效数字")
    if amount_dec <= 0 or amount_dec > Decimal("100000000"):
        raise ImportValidationError(f"{source} 第 {row_no} 行：金额需在 0.01 ~ 1 亿之间")

    parsed_date = _parse_date(date_value)
    if parsed_date is None:
        raise ImportValidationError(f"{source} 第 {row_no} 行：日期格式无法识别（建议 YYYY-MM-DD）")

    category_text = str(category or "").strip()
    if not category_text:
        raise ImportValidationError(f"{source} 第 {row_no} 行：类别不能为空")
    if len(category_text) > 32:
        raise ImportValidationError(f"{source} 第 {row_no} 行：类别不能超过 32 字")

    note_text = str(note or "").strip()
    if len(note_text) > 100:
        raise ImportValidationError(f"{source} 第 {row_no} 行：备注不能超过 100 字")

    return {
        "amount": amount_dec.quantize(Decimal("0.01")),
        "category": category_text,
        "date": parsed_date,
        "note": note_text,
    }


def _parse_date(value):
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None
