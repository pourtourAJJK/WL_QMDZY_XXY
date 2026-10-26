/**
 * categories.js — 类别定义与颜色映射
 * Epic 1, Story 1.1
 */
(function (global) {
  'use strict';

  // 7 个预置类别，每个带固定颜色
  const PRESET = [
    { name: '餐饮', color: '#FF6B6B' },
    { name: '交通', color: '#4ECDC4' },
    { name: '购物', color: '#FFD93D' },
    { name: '娱乐', color: '#6BCB77' },
    { name: '居住', color: '#4D96FF' },
    { name: '医疗', color: '#FF8C42' },
    { name: '其他', color: '#9B59B6' },
  ];

  // 供自定义类别取用的补充色板
  const EXTENDED_PALETTE = [
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#1ABC9C',
    '#9B59B6', '#34495E', '#E67E22', '#16A085', '#8E44AD',
  ];

  // localStorage key（自定义类别持久化）
  const CUSTOM_STORAGE_KEY = 'expense_dashboard_custom_categories';

  // ========== 公开 API ==========

  const Categories = {
    /** 获取所有预置类别 */
    get PRESET() {
      return PRESET.slice();
    },

    /** 从预置 + 自定义中合并出完整类别列表 */
    all() {
      const customs = loadCustom();
      return [...PRESET, ...customs];
    },

    /** 类别名 → 颜色 */
    getColorByName(name) {
      const found = this.all().find((c) => c.name === name);
      return found ? found.color : '#CCCCCC';
    },

    /** 检查类别是否存在 */
    exists(name) {
      return this.all().some((c) => c.name === name);
    },

    /** 添加自定义类别 */
    addCustom(name) {
      name = name.trim();
      if (!name) return { ok: false, reason: '类别名不能为空' };
      if (this.exists(name)) return { ok: false, reason: '类别已存在' };

      const customs = loadCustom();
      const usedColors = new Set([...PRESET, ...customs].map((c) => c.color));
      const available = EXTENDED_PALETTE.find((c) => !usedColors.has(c));
      const color = available || '#AAAAAA';

      const newItem = { name, color };
      customs.push(newItem);
      saveCustom(customs);

      return { ok: true, category: newItem };
    },
  };

  // ========== 内部 ==========

  function loadCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Failed to load custom categories:', e);
      return [];
    }
  }

  function saveCustom(list) {
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save custom categories:', e);
    }
  }

  global.Categories = Categories;
})(window);
