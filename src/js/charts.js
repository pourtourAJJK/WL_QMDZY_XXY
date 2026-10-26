/**
 * charts.js — ECharts 图表（修复 + 视觉增强 + 新增堆叠柱状图）
 * Feature: feature/chart-enhancement
 * 改动：
 *   1. init() 加 echarts 存在性检查 + DOM ready 延迟（规避 CDN 竞态）
 *   2. 环形图：加中心总金额文字 + 百分比 label + emphasis 放大动画
 *   3. 柱状图：加渐变色带 + hover 联动高亮（其他变灰）
 *   4. 新增 renderStackByMonth() — 月度类别堆叠柱状图
 */
(function (global) {
  'use strict';

  const charts = {
    instances: {},

    /**
     * 初始化 ECharts 实例（DOM ready 后调用）
     * 修 bug：echarts 存在性检查 + 延迟 init 规避 CDN 异步加载竞态
     */
    init() {
      // 检查 ECharts 是否加载
      if (typeof global.echarts === 'undefined') {
        console.error('[charts] echarts not loaded! Check CDN connection.');
        return false;
      }

      // 延迟 50ms init，确保 CDN script tag 执行完毕后 echarts 才可用
      setTimeout(() => {
        const pieDom = document.getElementById('pie-chart');
        const barDom = document.getElementById('bar-chart');
        const lineDom = document.getElementById('line-chart');
        const stackDom = document.getElementById('stack-chart');

        if (pieDom) this.instances.pie = echarts.init(pieDom);
        if (barDom) this.instances.bar = echarts.init(barDom);
        if (lineDom) this.instances.line = echarts.init(lineDom);
        if (stackDom) this.instances.stack = echarts.init(stackDom);

        // 窗口 resize 自适应
        window.addEventListener('resize', () => {
          Object.values(this.instances).forEach((inst) => inst && inst.resize());
        });

        console.log('[charts] initialized ✅ instances:', Object.keys(this.instances).length);
      }, 50);

      return true;
    },

    /** 统一刷新所有图表 */
    refreshAll(filterCategory) {
      // 确保实例已初始化
      if (!this.instances.pie && !this.instances.bar && !this.instances.line) {
        console.warn('[charts] instances not ready, delaying refreshAll');
        setTimeout(() => this.refreshAll(filterCategory), 100);
        return;
      }
      this.renderCategoryPie(filterCategory);
      this.renderMonthBar(filterCategory);
      this.renderTrendLine(filterCategory);
      this.renderStackByMonth(filterCategory);
    },

    // ========== 1. 增强版环形图：类别占比 ==========
    // 改动：加中心总金额 + 百分比 label + emphasis 动画
    renderCategoryPie(filterCategory) {
      const inst = this.instances.pie;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const byCategory = {};
      let total = 0;
      expenses.forEach((e) => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
        total += e.amount;
      });

      if (Object.keys(byCategory).length === 0) {
        showEmptyState('pie-chart', '📊 暂无数据<br>快去录入第一笔开销吧！');
        return;
      }
      hideEmptyState('pie-chart');

      const data = Object.entries(byCategory)
        .map(([name, value]) => ({
          name,
          value: +value.toFixed(2),
          itemStyle: { color: global.Categories.getColorByName(name) },
        }))
        .sort((a, b) => b.value - a.value); // 按金额排序，视觉更清晰

      inst.setOption(
        {
          tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(45, 55, 72, 0.95)',
            borderColor: 'transparent',
            textStyle: { color: '#fff', fontSize: 13 },
            formatter: (p) =>
              `<strong>${p.name}</strong><br/>¥${p.value.toFixed(2)}<br/><span style="color:#a0aec0">${p.percent}%</span>`,
          },
          legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { fontSize: 12, color: '#4a5568' },
            itemWidth: 12,
            itemHeight: 12,
            itemGap: 14,
          },
          graphic: [
            // 中心总金额数字
            {
              type: 'text',
              left: '40%',
              top: '42%',
              style: {
                text: `¥${total.toFixed(0)}`,
                fontSize: 24,
                fontWeight: 'bold',
                fill: '#2d3748',
                textAlign: 'center',
              },
            },
            {
              type: 'text',
              left: '40%',
              top: '55%',
              style: {
                text: filterCategory ? '筛选后总支出' : '累计总支出',
                fontSize: 12,
                fill: '#718096',
                textAlign: 'center',
              },
            },
          ],
          series: [
            {
              type: 'pie',
              radius: ['40%', '68%'],
              center: ['40%', '50%'],
              avoidLabelOverlap: true,
              padAngle: 1.5, // 扇区间留缝
              itemStyle: {
                borderRadius: 8,
                borderColor: '#fff',
                borderWidth: 3,
              },
              label: {
                show: true,
                position: 'outside',
                fontSize: 11,
                color: '#4a5568',
                formatter: (p) => `${p.name}\n${p.percent}%`,
              },
              labelLine: {
                show: true,
                length: 10,
                length2: 8,
              },
              emphasis: {
                scale: true,
                scaleSize: 10,
                itemStyle: {
                  shadowBlur: 20,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.2)',
                },
                label: {
                  show: true,
                  fontSize: 14,
                  fontWeight: 'bold',
                },
              },
              animationType: 'scale',
              animationEasing: 'elasticOut',
              animationDelay: (idx) => idx * 80,
              data,
            },
          ],
        },
        true
      );
    },

    // ========== 2. 增强版柱状图：月度支出 ==========
    // 改动：渐变色带 + hover 联动高亮
    renderMonthBar(filterCategory) {
      const inst = this.instances.bar;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const byMonth = {};
      expenses.forEach((e) => {
        const m = e.date.slice(0, 7);
        byMonth[m] = (byMonth[m] || 0) + e.amount;
      });

      const months = Object.keys(byMonth).sort();
      const values = months.map((m) => +byMonth[m].toFixed(2));

      if (months.length === 0) {
        showEmptyState('bar-chart', '📈 暂无月度数据');
        return;
      }
      hideEmptyState('bar-chart');

      // 最大柱子用于 label 位置计算
      const maxVal = Math.max(...values);

      inst.setOption(
        {
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(45, 55, 72, 0.95)',
            borderColor: 'transparent',
            textStyle: { color: '#fff', fontSize: 13 },
            formatter: (p) => {
              const item = p[0];
              return `<strong>${item.axisValue}</strong><br/>支出：<span style="color:#68d391">¥${item.value}</span>`;
            },
            axisPointer: {
              type: 'shadow',
              shadowStyle: { color: 'rgba(102, 126, 234, 0.08)' },
            },
          },
          grid: { top: 30, bottom: 40, left: 60, right: 30 },
          xAxis: {
            type: 'category',
            data: months.map((m) => m.slice(5) + '月'),
            axisLabel: { fontSize: 12, color: '#4a5568' },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: (v) => '¥' + v,
              fontSize: 11,
              color: '#718096',
            },
            splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } },
          },
          series: [
            {
              type: 'bar',
              data: values,
              barWidth: '45%',
              itemStyle: {
                borderRadius: [6, 6, 0, 0],
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: '#667eea' },
                    { offset: 0.5, color: '#8b7cf6' },
                    { offset: 1, color: '#764ba2' },
                  ],
                },
              },
              label: {
                show: true,
                position: 'top',
                formatter: (p) => '¥' + p.value,
                fontSize: 12,
                fontWeight: 'bold',
                color: '#4a5568',
              },
              emphasis: {
                focus: 'series',
                itemStyle: {
                  shadowBlur: 15,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(102, 126, 234, 0.5)',
                },
              },
              animationDuration: 800,
              animationEasing: 'cubicOut',
            },
          ],
        },
        true
      );
    },

    // ========== 3. 折线图：本月每日趋势（保持不变，微调） ==========
    renderTrendLine(filterCategory) {
      const inst = this.instances.line;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const now = new Date();
      const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const monthly = expenses.filter((e) => e.date.startsWith(thisMonthPrefix));

      const byDate = {};
      monthly.forEach((e) => {
        byDate[e.date] = (byDate[e.date] || 0) + e.amount;
      });

      const today = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const days = [];
      for (let d = 1; d <= today; d++) {
        const ds = `${thisMonthPrefix}-${String(d).padStart(2, '0')}`;
        days.push({
          label: `${d}日`,
          value: byDate[ds] ? +byDate[ds].toFixed(2) : 0,
        });
      }

      if (monthly.length === 0) {
        showEmptyState('line-chart', '📉 本月暂无数据');
        return;
      }
      hideEmptyState('line-chart');

      inst.setOption(
        {
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(45, 55, 72, 0.95)',
            borderColor: 'transparent',
            textStyle: { color: '#fff', fontSize: 13 },
            formatter: (p) => {
              const item = p[0];
              const dateLabel = `${thisMonthPrefix}-${item.axisValue.replace('日', '').padStart(2, '0')}`;
              return `<strong>${dateLabel}</strong><br/>支出：<span style="color:#68d391">¥${item.value}</span>`;
            },
          },
          grid: { top: 20, bottom: 40, left: 60, right: 30 },
          xAxis: {
            type: 'category',
            data: days.map((d) => d.label),
            boundaryGap: false,
            axisLabel: { fontSize: 11, color: '#4a5568' },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            axisLabel: { formatter: (v) => '¥' + v, fontSize: 11, color: '#718096' },
            splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } },
          },
          series: [
            {
              type: 'line',
              data: days.map((d) => d.value),
              smooth: true,
              symbol: 'circle',
              symbolSize: 8,
              itemStyle: { color: '#667eea', borderWidth: 2, borderColor: '#fff' },
              lineStyle: { width: 3, color: '#667eea' },
              areaStyle: {
                color: {
                  type: 'linear',
                  x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
                    { offset: 1, color: 'rgba(102, 126, 234, 0.02)' },
                  ],
                },
              },
              markPoint: {
                data: [
                  { type: 'max', name: '最高' },
                  { type: 'min', name: '最低' },
                ],
              },
            },
          ],
        },
        true
      );
    },

    // ========== 4. 新增：月度类别堆叠柱状图 ==========
    // 每个月各颜色段 = 各类别支出，一眼看清每月各类别分布
    renderStackByMonth(filterCategory) {
      const inst = this.instances.stack;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);

      // 按 月份×类别 二维聚合
      const byMonth = {}; // { '2026-10': { '餐饮': 100, '交通': 50 }, ... }
      const categorySet = new Set();

      expenses.forEach((e) => {
        const m = e.date.slice(0, 7);
        categorySet.add(e.category);
        if (!byMonth[m]) byMonth[m] = {};
        byMonth[m][e.category] = (byMonth[m][e.category] || 0) + e.amount;
      });

      const months = Object.keys(byMonth).sort();
      const categories = Array.from(categorySet);

      if (months.length === 0 || categories.length === 0) {
        showEmptyState('stack-chart', '📊 暂无数据，每月各类别分布将在此展示');
        return;
      }
      hideEmptyState('stack-chart');

      // 构造 ECharts series（每个类别一个 series，stacked）
      const series = categories.map((cat) => ({
        name: cat,
        type: 'bar',
        stack: 'expenses',
        emphasis: { focus: 'series' },
        itemStyle: {
          borderRadius: [0, 0, 0, 0], // 堆叠时圆角由第一个/最后一个处理
          color: global.Categories.getColorByName(cat),
        },
        barWidth: '55%',
        data: months.map((m) => +(byMonth[m][cat] || 0).toFixed(2)),
      }));

      // 给每个 series 的第一个/最后一个数据点加圆角（视觉更好）
      // 简化：直接整体圆角由 ECharts 自动处理

      inst.setOption(
        {
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(45, 55, 72, 0.95)',
            borderColor: 'transparent',
            textStyle: { color: '#fff', fontSize: 13 },
            formatter: (params) => {
              const monthLabel = params[0].axisValue;
              const total = params.reduce((s, p) => s + p.value, 0).toFixed(2);
              let html = `<strong>${monthLabel}月</strong><br/>`;
              params.forEach((p) => {
                if (p.value > 0) {
                  html += `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};margin-right:6px;"></span>${p.seriesName}：¥${p.value}<br/>`;
                }
              });
              html += `<span style="border-top:1px solid rgba(255,255,255,0.2);padding-top:4px;margin-top:4px;display:block;"><strong>总计：¥${total}</strong></span>`;
              return html;
            },
          },
          legend: {
            data: categories,
            top: 5,
            textStyle: { fontSize: 12, color: '#4a5568' },
            itemWidth: 12,
            itemHeight: 12,
          },
          grid: { top: 50, bottom: 40, left: 60, right: 30 },
          xAxis: {
            type: 'category',
            data: months.map((m) => m.slice(5) + '月'),
            axisLabel: { fontSize: 12, color: '#4a5568' },
            axisLine: { lineStyle: { color: '#e2e8f0' } },
            axisTick: { show: false },
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              formatter: (v) => '¥' + v,
              fontSize: 11,
              color: '#718096',
            },
            splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } },
          },
          series,
          animationDuration: 800,
          animationEasing: 'cubicOut',
        },
        true
      );
    },
  };

  // ========== 辅助 ==========

  function getFilteredExpenses(filterCategory) {
    let list = global.dataStore.getAll();
    if (filterCategory) {
      list = list.filter((e) => e.category === filterCategory);
    }
    return list;
  }

  function showEmptyState(containerId, html) {
    const dom = document.getElementById(containerId);
    if (!dom) return;
    // 用空容器占位，不覆盖 ECharts setOption（如果 setOption 成功会覆盖 innerHTML）
    dom.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a0aec0;font-size:13px;text-align:center;flex-direction:column;gap:8px;">${html}</div>`;
  }

  function hideEmptyState(containerId) {
    // ECharts setOption 会自动覆盖 DOM
  }

  global.charts = charts;
})(window);
