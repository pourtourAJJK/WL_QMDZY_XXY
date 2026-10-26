/**
 * renderer.js — 统一刷新协调器
 * Epic 5 实现真实协调；此处仅 stub 占位
 */
(function (global) {
  'use strict';

  const renderer = {
    /**
     * 统一刷新所有子模块
     * @param {string} [filterCategory] 类别筛选，空字符串表示全部
     */
    refreshAll(filterCategory) {
      // Epic 5 实现协调顺序；当前占位
      console.log('[renderer] refreshAll called, filter=', filterCategory || '(none)');
    },
  };

  global.renderer = renderer;
})(window);
