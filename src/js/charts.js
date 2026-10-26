/**
 * charts.js — ECharts 三张图表封装
 * Epic 3 实现真实渲染；此处仅 stub 占位避免 HTML 加载错误
 */
(function (global) {
  'use strict';

  const charts = {
    _instances: {},

    /** 初始化（Epic 3 填充真实逻辑） */
    init() {
      this._instances.pie = null;
      this._instances.bar = null;
      this._instances.line = null;
    },

    /** 渲染类别占比环形图（Epic 3 填充） */
    renderCategoryPie() { /* stub */ },

    /** 渲染月度支出柱状图（Epic 3 填充） */
    renderMonthBar() { /* stub */ },

    /** 渲染当月趋势折线图（Epic 3 填充） */
    renderTrendLine() { /* stub */ },

    /** 全部刷新（Epic 3 填充） */
    refreshAll(filter) { /* stub */ },
  };

  global.charts = charts;
})(window);
