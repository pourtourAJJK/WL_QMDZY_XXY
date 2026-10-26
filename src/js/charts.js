/**
 * charts.js — 三张 ECharts 图表完整实现
 * Epic 3: Story 3.1 (环形图), 3.2 (柱状图), 3.3 (折线图)
 */
(function (global) {
  'use strict';

  const charts = {
    instances: {},

    /** 在 DOM ready 后调用一次，初始化 ECharts 实例 */
    init() {
      const pieDom = document.getElementById('pie-chart');
      const barDom = document.getElementById('bar-chart');
      const lineDom = document.getElementById('line-chart');

      if (global.echarts && pieDom) this.instances.pie = echarts.init(pieDom);
      if (global.echarts && barDom) this.instances.bar = echarts.init(barDom);
      if (global.echarts && lineDom) this.instances.line = echarts.init(lineDom);

      // 窗口 resize 时图表自适应
      window.addEventListener('resize', () => {
        Object.values(this.instances).forEach((inst) => inst && inst.resize());
      });
    },

    /** 统一刷新三张图表 */
    refreshAll(filterCategory) {
      this.renderCategoryPie(filterCategory);
      this.renderMonthBar(filterCategory);
      this.renderTrendLine(filterCategory);
    },

    // ========== 环形图：类别占比 ==========
    renderCategoryPie(filterCategory) {
      const inst = this.instances.pie;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const byCategory = {};
      expenses.forEach((e) => {
        byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      });

      if (Object.keys(byCategory).length === 0) {
        showEmptyState('pie-chart', '暂无数据<br>快去录入第一笔开销吧！');
        return;
      }
      hideEmptyState('pie-chart');

      const data = Object.entries(byCategory).map(([name, value]) => ({
        name,
        value: +value.toFixed(2),
        itemStyle: { color: global.Categories.getColorByName(name) },
      }));

      inst.setOption({
        tooltip: {
          trigger: 'item',
          formatter: (p) => `${p.name}: ¥${p.value} (${p.percent}%)`,
        },
        legend: {
          orient: 'vertical',
          right: 10,
          top: 'center',
          textStyle: { fontSize: 12 },
        },
        series: [
          {
            type: 'pie',
            radius: ['35%', '65%'],
            center: ['40%', '50%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: 'bold' },
            },
            data,
          },
        ],
      });
    },

    // ========== 柱状图：月度支出 ==========
    renderMonthBar(filterCategory) {
      const inst = this.instances.bar;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const byMonth = {};
      expenses.forEach((e) => {
        const m = e.date.slice(0, 7); // YYYY-MM
        byMonth[m] = (byMonth[m] || 0) + e.amount;
      });

      // 按月份排序
      const months = Object.keys(byMonth).sort();
      const values = months.map((m) => +byMonth[m].toFixed(2));

      if (months.length === 0) {
        showEmptyState('bar-chart', '暂无月度数据');
        return;
      }
      hideEmptyState('bar-chart');

      inst.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: (p) => `${p[0].axisValue}: ¥${p[0].value}`,
        },
        grid: { top: 20, bottom: 40, left: 50, right: 20 },
        xAxis: {
          type: 'category',
          data: months.map((m) => m.slice(5) + '月'),
          axisLabel: { fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { formatter: '¥{value}' },
        },
        series: [
          {
            type: 'bar',
            data: values,
            barWidth: '55%',
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: '#667eea' },
                  { offset: 1, color: '#764ba2' },
                ],
              },
            },
            label: {
              show: true,
              position: 'top',
              formatter: (p) => '¥' + p.value,
              fontSize: 11,
              color: '#718096',
            },
          },
        ],
      });
    },

    // ========== 折线图：本月每日趋势 ==========
    renderTrendLine(filterCategory) {
      const inst = this.instances.line;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const now = new Date();
      const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // 只保留本月数据
      const monthly = expenses.filter((e) => e.date.startsWith(thisMonthPrefix));

      // 按日期聚合
      const byDate = {};
      monthly.forEach((e) => {
        byDate[e.date] = (byDate[e.date] || 0) + e.amount;
      });

      // 构造日期序列（本月 1 日到今天）
      const days = [];
      const today = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= today; d++) {
        const ds = `${thisMonthPrefix}-${String(d).padStart(2, '0')}`;
        days.push({
          label: `${d}日`,
          value: byDate[ds] ? +byDate[ds].toFixed(2) : 0,
        });
      }

      if (monthly.length === 0) {
        showEmptyState('line-chart', '本月暂无数据');
        return;
      }
      hideEmptyState('line-chart');

      inst.setOption({
        tooltip: {
          trigger: 'axis',
          formatter: (p) => `${thisMonthPrefix}-${p[0].axisValue.replace('日', '')}: ¥${p[0].value}`,
        },
        grid: { top: 20, bottom: 40, left: 50, right: 20 },
        xAxis: {
          type: 'category',
          data: days.map((d) => d.label),
          boundaryGap: false,
          axisLabel: { fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          axisLabel: { formatter: '¥{value}' },
        },
        series: [
          {
            type: 'line',
            data: days.map((d) => d.value),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: '#667eea' },
            lineStyle: { width: 3, color: '#667eea' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(102, 126, 234, 0.35)' },
                  { offset: 1, color: 'rgba(102, 126, 234, 0.02)' },
                ],
              },
            },
          },
        ],
      });
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
    dom.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a0aec0;font-size:14px;text-align:center;">${html}</div>`;
  }

  function hideEmptyState(containerId) {
    // 什么都不做，ECharts setOption 会覆盖 DOM 内容
  }

  global.charts = charts;
})(window);
