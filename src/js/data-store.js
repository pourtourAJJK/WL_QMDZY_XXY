/**
 * data-store.js — localStorage 数据层（开销 CRUD + JSON 导入导出）
 * Epic 1, Story 1.2
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'expense_dashboard_data';
  const SCHEMA_VERSION = 1;

  // ========== 公开 API ==========

  const dataStore = {
    /** 读取全部开销记录（数组，按日期倒序） */
    getAll() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.expenses || [];
      } catch (e) {
        console.warn('dataStore.getAll failed:', e);
        return [];
      }
    },

    /** 添加一条开销 */
    add(expense) {
      if (!expense || !expense.amount || !expense.category || !expense.date) {
        throw new Error('Invalid expense: missing required fields');
      }
      const list = this.getAll();
      const newItem = {
        id: expense.id || generateId(),
        amount: Number(expense.amount),
        category: expense.category,
        date: expense.date,
        note: expense.note || '',
        created_at: new Date().toISOString(),
      };
      list.push(newItem);
      save(list);
      return newItem;
    },

    /** 删除一条开销 */
    delete(id) {
      const list = this.getAll();
      const next = list.filter((item) => item.id !== id);
      save(next);
      return next.length !== list.length;
    },

    // ============ 导出 ============

    /** 导出为 JSON 字符串 */
    exportJSON() {
      return JSON.stringify(
        {
          schema_version: SCHEMA_VERSION,
          exported_at: new Date().toISOString(),
          expenses: this.getAll(),
        },
        null,
        2
      );
    },

    /** 导出为 CSV 字符串（带 UTF-8 BOM，Excel 打开中文不乱码） */
    exportCSV() {
      const expenses = this.getAll();
      const headers = ['id', 'date', 'category', 'amount', 'note', 'created_at'];
      const headerLine = headers.join(',');
      const rows = expenses.map((e) =>
        headers.map((h) => escapeCSVField(e[h] ?? '')).join(',')
      );
      // 加 UTF-8 BOM，保证 Excel 打开中文不乱码
      return '\ufeff' + [headerLine, ...rows].join('\r\n');
    },

    /** 导出为 Excel（SheetJS）。返回 ArrayBuffer，调用方负责下载。 */
    exportExcel() {
      if (!global.XLSX) {
        throw new Error('Excel 导出需要 SheetJS 库加载，请刷新页面或检查网络');
      }
      const expenses = this.getAll();
      // 行数据（header + data）
      const aoa = [
        ['ID', '日期', '类别', '金额', '备注', '创建时间'],
        ...expenses.map((e) => [
          e.id,
          e.date,
          e.category,
          Number(e.amount),
          e.note || '',
          (e.created_at || '').replace('T', ' ').slice(0, 19),
        ]),
      ];
      const ws = global.XLSX.utils.aoa_to_sheet(aoa);
      // 列宽
      ws['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 10 },
        { wch: 10 }, { wch: 20 }, { wch: 20 },
      ];
      const wb = global.XLSX.utils.book_new();
      global.XLSX.utils.book_append_sheet(wb, ws, '开销记录');
      return global.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    },

    // ============ 导入 ============

    /** 从 JSON 字符串导入（覆盖） */
    importJSON(jsonStr) {
      const data = JSON.parse(jsonStr);
      const list = extractExpenses(data);
      save(list);
      return list.length;
    },

    /** 从 CSV 字符串导入（覆盖） */
    importCSV(csvStr) {
      const rows = parseCSV(csvStr);
      if (rows.length < 2) throw new Error('CSV 文件为空或只有表头');
      // 第一行是表头，跳过
      const expenses = rows.slice(1).map((cols) => csvRowToExpense(cols)).filter(Boolean);
      validateExpenses(expenses);
      save(expenses);
      return expenses.length;
    },

    /** 从 Excel ArrayBuffer 导入（覆盖） */
    importExcel(arrayBuffer) {
      if (!global.XLSX) {
        throw new Error('Excel 导入需要 SheetJS 库加载，请刷新页面或检查网络');
      }
      const wb = global.XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = global.XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (aoa.length < 2) throw new Error('Excel 文件为空或只有表头');
      const expenses = aoa.slice(1).map((row) => excelRowToExpense(row)).filter(Boolean);
      validateExpenses(expenses);
      save(expenses);
      return expenses.length;
    },

    /** 清空全部数据 */
    clear() {
      save([]);
    },

    /** schema_version 常量 */
    get SCHEMA_VERSION() {
      return SCHEMA_VERSION;
    },
  };

  // ========== 内部 ==========

  function save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expenses: list }));
    } catch (e) {
      console.warn('dataStore.save failed:', e);
      throw new Error('无法保存数据，请检查浏览器存储权限');
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ============ 多格式辅助函数 ============

  /** 从 JSON 结构里提取 expenses 数组（兼容带 schema_version 和直接数组两种格式） */
  function extractExpenses(data) {
    if (Array.isArray(data)) {
      validateExpenses(data);
      return data;
    }
    if (data && Array.isArray(data.expenses)) {
      validateExpenses(data.expenses);
      return data.expenses;
    }
    throw new Error('Invalid data format: missing expenses array');
  }

  /** 校验 expense 记录的必要字段 */
  function validateExpenses(list) {
    for (const exp of list) {
      if (typeof exp.amount !== 'number' || !exp.category || !exp.date) {
        throw new Error('Invalid expense record: amount/category/date required');
      }
    }
  }

  /** CSV 字段转义：含逗号/引号/换行时用引号包裹，内部引号翻倍 */
  function escapeCSVField(value) {
    const str = String(value ?? '');
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /** 原生 CSV 解析器（支持引号包裹、字段内逗号和换行） */
  function parseCSV(text) {
    // 去掉 UTF-8 BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { currentField += '"'; i++; } // 双引号转义
          else inQuotes = false;
        } else {
          currentField += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { currentRow.push(currentField); currentField = ''; }
        else if (ch === '\r') { /* skip, \n follows */ }
        else if (ch === '\n') {
          currentRow.push(currentField); currentField = '';
          rows.push(currentRow); currentRow = [];
        } else { currentField += ch; }
      }
    }
    // 最后一行（可能没有 \n 结尾）
    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  }

  /** CSV 行（按 id,date,category,amount,note,created_at 顺序）转 expense 对象 */
  function csvRowToExpense(cols) {
    if (!cols || cols.length < 4) return null;
    const amount = parseFloat(cols[3]);
    if (isNaN(amount)) return null;
    return {
      id: cols[0] || generateId(),
      date: cols[1] || '',
      category: cols[2] || '',
      amount,
      note: cols[4] || '',
      created_at: cols[5] || new Date().toISOString(),
    };
  }

  /** Excel 行（中文表头顺序：ID,日期,类别,金额,备注,创建时间）转 expense 对象 */
  function excelRowToExpense(row) {
    if (!row || row.length < 4) return null;
    // row 是 XLSX.utils.sheet_to_json(header:1) 返回的数组
    // 中文表头映射：索引 0=ID, 1=日期, 2=类别, 3=金额, 4=备注, 5=创建时间
    const amount = Number(row[3]);
    if (isNaN(amount)) return null;
    return {
      id: row[0] || generateId(),
      date: String(row[1] || ''),
      category: String(row[2] || ''),
      amount,
      note: String(row[4] || ''),
      created_at: String(row[5] || new Date().toISOString()),
    };
  }

  global.dataStore = dataStore;
})(window);
