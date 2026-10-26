/**
 * renderer.js — 统一刷新协调器
 * Epic 5: Story 5.2
 */
(function (global) {
  'use strict';

  const renderer = {
    /**
     * 统一刷新所有子模块（按依赖顺序）
     * @param {string} [filterCategory] 类别筛选，空字符串表示全部
     *
     * 协调顺序（符合 AD-2 / AD-4 依赖方向）：
     *   1. charts  → 三张 ECharts 图表（依赖 dataStore）
     *   2. cards   → 三张统计卡片（依赖 dataStore）
     *   3. listView → 开销列表 + 筛选下拉框（依赖 dataStore + Categories）
     */
    refreshAll(filterCategory) {
      // filterCategory 为 undefined 或 null 时转为空字符串（表示"全部"）
      const filter = filterCategory || '';

      // 1. 图表
      if (global.charts && typeof global.charts.refreshAll === 'function') {
        try { global.charts.refreshAll(filter); }
        catch (e) { console.error('[renderer] charts.refreshAll failed:', e); }
      }

      // 2. 卡片（卡片不需要筛选参数，因为筛选场景下卡片会显示"筛选后的数字"——这是合理的）
      if (global.cards && typeof global.cards.refreshAll === 'function') {
        try { global.cards.refreshAll(); }
        catch (e) { console.error('[renderer] cards.refreshAll failed:', e); }
      }

      // 3. 列表
      if (global.listView && typeof global.listView.refreshAll === 'function') {
        try { global.listView.refreshAll(filter); }
        catch (e) { console.error('[renderer] listView.refreshAll failed:', e); }
      }
    },
  };

  global.renderer = renderer;
})(window);
