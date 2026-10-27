"""服务端导入解析（JSON / CSV / XLSX / HTML 表格）。

安全要点：
- 大小上限 5MB、行数上限 5000，超限直接拒绝；
- 逐行校验金额（>0）、日期、类别、备注长度，任一行不合法则整份文件拒绝；
- 兼容记账软件/银行导出的"伪 Excel"（HTML 表格改名 .xls/.xlsx），用标准库解析第一张 <table>；
- 真正的旧版二进制 .xls 仍需另存为 .xlsx，避免引入不安全的旧格式解析器；
- 解析与写入在事务中完成，失败不会破坏用户既有数据。
"""
import csv
import io
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser

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

    # 内容嗅探优先于扩展名：很多"xlsx/xls"其实是 HTML 网页（记账软件/银行导出）
    if _looks_like_html(raw):
        records = _parse_html(raw)
    elif _looks_like_binary_xls(raw):
        raise ImportValidationError("暂不支持旧版二进制 .xls，请用 Excel/WPS 打开后另存为 .xlsx 再导入")
    elif ext == "json":
        records = _parse_json(raw)
    elif ext in ("csv", "txt"):
        records = _parse_csv(raw)
    elif ext in ("xlsx", "xls"):
        records = _parse_xlsx(raw)
    else:
        raise ImportValidationError("仅支持 .json / .csv / .xlsx 文件")

    if not records:
        raise ImportValidationError("文件中没有可导入的数据")
    if len(records) > MAX_ROWS:
        raise ImportValidationError(f"单次最多导入 {MAX_ROWS} 条记录")
    return records


# ============ 内容嗅探 ============

_OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def _looks_like_html(raw: bytes) -> bool:
    head = raw[:512].lstrip(b"\xef\xbb\xbf \t\r\n").lower()
    return head.startswith(b"<") and (
        head.startswith((b"<!doctype", b"<html", b"<table", b"<head", b"<body", b"<meta"))
        or b"<table" in head
    )


def _looks_like_binary_xls(raw: bytes) -> bool:
    return raw[:8] == _OLE2_MAGIC


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

    # 微信支付账单：前若干行是账单元信息，真正表头含"交易时间""金额(元)"
    if _is_wechat_bill(rows):
        return _parse_wechat_bill(rows)
    return _records_from_rows(rows, "Excel")


# ============ 微信支付账单 ============

_WECHAT_HEADER = ("交易时间", "金额(元)")


def _is_wechat_bill(rows: list[list]) -> bool:
    for row in rows[:30]:  # 表头通常在前 30 行内
        cells = {str(c).strip() for c in row if c is not None}
        if all(marker in cells for marker in _WECHAT_HEADER):
            return True
    return False


def _parse_wechat_bill(rows: list[list]) -> list[dict]:
    """解析微信支付账单明细，只导入"支出"行，跳过已全额退款的交易。"""
    header_idx = None
    header = None
    for i, row in enumerate(rows):
        cells = [str(c).strip() for c in row if c is not None]
        if all(m in cells for m in _WECHAT_HEADER):
            header_idx = i
            header = cells
            break
    if header_idx is None:
        raise ImportValidationError("微信账单未找到表头行")

    col = {name: idx for idx, name in enumerate(header)}
    date_i = col["交易时间"]
    amount_i = col["金额(元)"]
    direction_i = col.get("收/支")
    type_i = col.get("交易类型")
    merchant_i = col.get("交易对方")
    goods_i = col.get("商品")
    status_i = col.get("当前状态")
    remark_i = col.get("备注")

    records = []
    offset = 0
    for row in rows[header_idx + 1:]:
        direction = str(row[direction_i]).strip() if direction_i is not None and direction_i < len(row) else "支出"
        # 只统计支出；收入/中性交易跳过
        if direction != "支出":
            continue
        # 跳过已全额退款的交易，避免虚增支出
        status = str(row[status_i]).strip() if status_i is not None and status_i < len(row) else ""
        if "退款" in status:
            continue

        offset += 1
        amount = row[amount_i] if amount_i < len(row) else None
        date_val = row[date_i] if date_i < len(row) else None
        category = (
            str(row[type_i]).strip()
            if type_i is not None and type_i < len(row) and row[type_i] is not None
            else "其他"
        )
        # 备注优先取商品描述，其次交易对方，最后备注列
        note_parts = []
        for src in (goods_i, merchant_i, remark_i):
            if src is not None and src < len(row) and row[src] is not None:
                val = str(row[src]).strip()
                if val and val != "/":
                    note_parts.append(val)
        note = " · ".join(note_parts)[:100]

        records.append(_normalize(amount, date_val, category, note, offset, "微信账单"))
    if not records:
        raise ImportValidationError("微信账单中没有可导入的支出记录")
    return records


def _parse_html(raw: bytes) -> list[dict]:
    """解析"HTML 表格伪装成 Excel"的文件（账单导出常见），只取第一张 <table>。"""
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = raw.decode("gb18030")
        except UnicodeDecodeError as exc:
            raise ImportValidationError("网页文件编码无法识别（需 UTF-8 或 GB18030）") from exc

    parser = _FirstTableParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:
        raise ImportValidationError("网页内容解析失败，请用 Excel/WPS 另存为 .xlsx 后重试") from exc

    if not parser.rows:
        raise ImportValidationError(
            "文件内容实际是网页而不是 Excel 表格（未找到 <table>），"
            "请用 Excel/WPS 打开后另存为 .xlsx 再导入"
        )
    return _records_from_rows(parser.rows, "Excel")


def _records_from_rows(rows: list[list], source: str) -> list[dict]:
    """表格行（xlsx/HTML 共用）→ 校验后的记录。"""
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
                source,
            )
        )
    return records


class _FirstTableParser(HTMLParser):
    """提取第一张 <table> 的全部行（th/td 文本），忽略其余内容。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self._in_table = False
        self._done = False
        self._current_row: list[str] | None = None
        self._cell_parts: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        if tag == "table":
            self._in_table = True
        elif self._in_table and tag == "tr":
            self._current_row = []
        elif self._current_row is not None and tag in ("td", "th"):
            self._cell_parts = []

    def handle_data(self, data):
        if self._cell_parts is not None:
            self._cell_parts.append(data)

    def handle_endtag(self, tag):
        if self._done:
            return
        if tag in ("td", "th") and self._cell_parts is not None:
            self._current_row.append("".join(self._cell_parts).strip())
            self._cell_parts = None
        elif tag == "tr" and self._current_row is not None:
            if any(cell for cell in self._current_row):
                self.rows.append(self._current_row)
            self._current_row = None
        elif tag == "table" and self._in_table:
            self._in_table = False
            self._done = True


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
