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

    /** 从 JSON 字符串导入（覆盖） */
    importJSON(jsonStr) {
      const data = JSON.parse(jsonStr);
      if (!data || !Array.isArray(data.expenses)) {
        throw new Error('Invalid backup format: missing expenses array');
      }
      // 简单字段校验
      for (const exp of data.expenses) {
        if (typeof exp.amount !== 'number' || !exp.category || !exp.date) {
          throw new Error('Invalid expense record in backup');
        }
      }
      save(data.expenses);
      return data.expenses.length;
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

  global.dataStore = dataStore;
})(window);
