/**
 * data-store.js — 后端数据层（JWT 鉴权 + 内存缓存 + 三格式导出）
 *
 * 与旧版差异：
 *   1. 数据唯一事实源在 Django + SQLite，浏览器不再保存开销数据；
 *   2. 增删改与导入全部走后端接口，后端按 user 隔离并逐行校验；
 *   3. getAll() 保持同步，读取最近一次 load() 的内存快照，避免改动图表/卡片渲染逻辑。
 */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;
  let cache = [];

  const dataStore = {
    /** 从后端拉取当前用户的全部开销，刷新内存快照 */
    async load() {
      const data = await global.api.request('/api/expenses/');
      cache = Array.isArray(data) ? data : [];
      return cache;
    },

    /** 读取内存快照（同步，供图表/卡片/列表渲染） */
    getAll() {
      return cache.slice();
    },

    /** 新增一条开销（后端落库后返回完整记录） */
    async add(expense) {
      if (!expense || !expense.amount || !expense.category || !expense.date) {
        throw new Error('Invalid expense: missing required fields');
      }
      const created = await global.api.request('/api/expenses/', {
        method: 'POST',
        body: {
          amount: Number(expense.amount),
          category: expense.category,
          date: expense.date,
          note: expense.note || '',
        },
      });
      cache.push(created);
      return created;
    },

    /** 删除一条开销 */
    async delete(id) {
      await global.api.request('/api/expenses/' + encodeURIComponent(id) + '/', {
        method: 'DELETE',
      });
      const before = cache.length;
      cache = cache.filter((item) => String(item.id) !== String(id));
      return cache.length !== before;
    },

    /** 清空当前用户全部数据 */
    async clear() {
      await global.api.request('/api/expenses/clear/', { method: 'DELETE' });
      cache = [];
    },

    /**
     * 导入文件：上传到后端解析与校验（JSON / CSV / XLSX），成功后重新拉取快照
     * @param {File} file
     * @returns {Promise<number>} 导入条数
     */
    async importFile(file) {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const result = await global.api.request('/api/expenses/import/', {
        method: 'POST',
        body: formData,
      });
      await this.load();
      return result.imported;
    },

    // ============ 导出（基于后端快照，纯本地生成文件） ============

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
      return '\ufeff' + [headerLine, ...rows].join('\r\n');
    },

    /** schema_version 常量 */
    get SCHEMA_VERSION() {
      return SCHEMA_VERSION;
    },
  };

  /** CSV 字段转义：含逗号/引号/换行时用引号包裹，内部引号翻倍 */
  function escapeCSVField(value) {
    const str = String(value ?? '');
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  global.dataStore = dataStore;
})(window);
