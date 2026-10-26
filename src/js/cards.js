/**
 * cards.js — 三张统计卡片（总支出、本月支出、最高单笔）
 * Epic 3: Story 3.4
 */
(function (global) {
  'use strict';

  const cards = {
    /** 刷新三张卡片 */
    refreshAll() {
      const expenses = global.dataStore.getAll();

      // 1. 累计总支出
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      setText('total-amount', formatMoney(total));

      // 2. 本月支出
      const now = new Date();
      const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const month = expenses
        .filter((e) => e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + e.amount, 0);
      setText('month-amount', formatMoney(month));

      // 3. 最高单笔
      if (expenses.length === 0) {
        setText('max-amount', '¥0.00');
        setText('max-category', '');
        return;
      }
      const max = expenses.reduce((a, b) => (a.amount > b.amount ? a : b));
      setText('max-amount', formatMoney(max.amount));
      setText('max-category', '类别：' + max.category + ' · ' + max.date);
    },
  };

  // ========== 工具 ==========

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatMoney(num) {
    return '¥' + Number(num).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  global.cards = cards;
})(window);
