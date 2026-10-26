/**
 * charts.js — ECharts 图表（修复版）
 * Feature: feature/fix-chart-render
 * 根因：setTimeout 延迟 init 时序混乱 + ECharts.init() 时容器可能还在 0×0 尺寸
 * 修复：
 *   1. init() 用 requestAnimationFrame 同步 init（DOM ready + echarts CDN 已加载）
 *   2. init 后手动 resize 一次（确保 display:none → block 后的尺寸正确）
 *   3. refreshAll 里 setOption 后加 inst.resize() 双保险
 *   4. echarts 未加载时给降级提示 HTML
 *   5. refreshAll 加最大重试次数（避免无限循环）
 */
(function (global) {
  'use strict';

  const charts = {
    instances: {},
    _retryCount: 0,
    _MAX_RETRY: 5,

    /**
     * 初始化 ECharts 实例
     * 返回 Promise，resolve 后所有实例已就绪 + resize 已执行
     * 调用方可以 await charts.init() 彻底消除时序竞态
     */
    init() {
      return new Promise((resolve, reject) => {
        // 1. echarts 是否加载
        if (typeof global.echarts === 'undefined') {
          console.error('[charts] ❌ echarts not loaded! Check CDN connection.');
          ['pie-chart', 'bar-chart', 'line-chart', 'stack-chart'].forEach((id) => {
            showDegraded(id, '📊 图表库加载失败<br>请检查网络后刷新页面');
          });
          reject(new Error('echarts not loaded'));
          return;
        }

        // 2. 用 requestAnimationFrame 等浏览器 layout 完成（display:none → block 后必须等一帧）
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.instances = {}; // 重置（防止重复 init 留下脏实例）

            try {
              const pieDom = document.getElementById('pie-chart');
              const barDom = document.getElementById('bar-chart');
              const lineDom = document.getElementById('line-chart');
              const stackDom = document.getElementById('stack-chart');

              if (pieDom) { pieDom.innerHTML = ''; this.instances.pie = echarts.init(pieDom); }
              if (barDom) { barDom.innerHTML = ''; this.instances.bar = echarts.init(barDom); }
              if (lineDom) { lineDom.innerHTML = ''; this.instances.line = echarts.init(lineDom); }
              if (stackDom) { stackDom.innerHTML = ''; this.instances.stack = echarts.init(stackDom); }

              // 3. resize + 监听窗口
              Object.values(this.instances).forEach((inst) => { try { inst.resize(); } catch (e) {} });
              window.addEventListener('resize', () => {
                Object.values(this.instances).forEach((inst) => { try { inst.resize(); } catch (e) {} });
              });

              console.log('[charts] ✅ initialized. instances:', Object.keys(this.instances).join(', '));

              // 4. 调试日志：确认 dataStore 有数据
              const debugList = global.dataStore ? global.dataStore.getAll() : [];
              console.log('[charts] dataStore.getAll() returned:', debugList.length, 'expenses');

              // 5. resolve Promise，让调用方可以 await
              resolve(true);
            } catch (e) {
              console.error('[charts] ❌ echarts.init failed:', e);
              reject(e);
            }
          });
        });
      });
    },

    /** 统一刷新所有图表 */
    refreshAll(filterCategory) {
      const instancesReady = this.instances.pie && this.instances.bar && this.instances.line;

      if (!instancesReady) {
        if (this._retryCount < this._MAX_RETRY) {
          this._retryCount++;
          console.warn(`[charts] instances not ready (retry ${this._retryCount}/${this._MAX_RETRY}), delaying refreshAll`);
          this._pendingFilter = filterCategory;
          setTimeout(() => this.refreshAll(filterCategory), 100);
        } else {
          console.error('[charts] ❌ max retries exceeded — ECharts instances never initialized');
          ['pie-chart', 'bar-chart', 'line-chart', 'stack-chart'].forEach((id) => {
            showDegraded(id, '📊 图表初始化超时<br>请刷新页面重试');
          });
        }
        return;
      }

      this._retryCount = 0;

      this.renderCategoryPie(filterCategory);
      this.renderMonthBar(filterCategory);
      this.renderTrendLine(filterCategory);
      this.renderStackByMonth(filterCategory);

      console.log('[charts] 🎨 all charts refreshed');
    },

    // ========== 1. 环形图 ==========
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
          name, value: +value.toFixed(2),
          itemStyle: { color: global.Categories.getColorByName(name) },
        }))
        .sort((a, b) => b.value - a.value);

      inst.setOption({
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(45, 55, 72, 0.95)',
          borderColor: 'transparent',
          textStyle: { color: '#fff', fontSize: 13 },
          formatter: (p) => `<strong>${p.name}</strong><br/>¥${p.value.toFixed(2)}<br/><span style="color:#a0aec0">${p.percent}%</span>`,
        },
        legend: {
          orient: 'vertical', right: 10, top: 'center',
          textStyle: { fontSize: 12, color: '#4a5568' },
          itemWidth: 12, itemHeight: 12, itemGap: 14,
        },
        graphic: [
          { type: 'text', left: '40%', top: '42%',
            style: { text: `¥${total.toFixed(0)}`, fontSize: 24, fontWeight: 'bold', fill: '#2d3748', textAlign: 'center' } },
          { type: 'text', left: '40%', top: '55%',
            style: { text: filterCategory ? '筛选后总支出' : '累计总支出', fontSize: 12, fill: '#718096', textAlign: 'center' } },
        ],
        series: [{
          type: 'pie', radius: ['40%', '68%'], center: ['40%', '50%'],
          padAngle: 1.5,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
          label: { show: true, position: 'outside', fontSize: 11, color: '#4a5568',
            formatter: (p) => `${p.name}\n${p.percent}%` },
          labelLine: { show: true, length: 10, length2: 8 },
          emphasis: { scale: true, scaleSize: 10,
            itemStyle: { shadowBlur: 20, shadowColor: 'rgba(0,0,0,0.2)' },
            label: { show: true, fontSize: 14, fontWeight: 'bold' } },
          animationType: 'scale', animationEasing: 'elasticOut', animationDelay: (idx) => idx * 80,
          data,
        }],
      }, true);

      inst.resize();
    },

    // ========== 2. 柱状图 ==========
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

      inst.setOption({
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(45, 55, 72, 0.95)', borderColor: 'transparent',
          textStyle: { color: '#fff', fontSize: 13 },
          formatter: (p) => `<strong>${p[0].axisValue}</strong><br/>支出：<span style="color:#68d391">¥${p[0].value}</span>`,
          axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(102, 126, 234, 0.08)' } },
        },
        grid: { top: 30, bottom: 40, left: 60, right: 30 },
        xAxis: { type: 'category', data: months.map((m) => m.slice(5) + '月'),
          axisLabel: { fontSize: 12, color: '#4a5568' }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
        yAxis: { type: 'value',
          axisLabel: { formatter: (v) => '¥' + v, fontSize: 11, color: '#718096' },
          splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } } },
        series: [{
          type: 'bar', data: values, barWidth: '45%',
          itemStyle: { borderRadius: [6, 6, 0, 0],
            color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 0.5, color: '#8b7cf6' },
                { offset: 1, color: '#764ba2' } ] } },
          label: { show: true, position: 'top', formatter: (p) => '¥' + p.value,
            fontSize: 12, fontWeight: 'bold', color: '#4a5568' },
          emphasis: { focus: 'series',
            itemStyle: { shadowBlur: 15, shadowColor: 'rgba(102, 126, 234, 0.5)' } },
          animationDuration: 800, animationEasing: 'cubicOut',
        }],
      }, true);

      inst.resize();
    },

    // ========== 3. 折线图 ==========
    renderTrendLine(filterCategory) {
      const inst = this.instances.line;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const now = new Date();
      const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthly = expenses.filter((e) => e.date.startsWith(thisMonthPrefix));
      const byDate = {};
      monthly.forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + e.amount; });

      const today = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const days = [];
      for (let d = 1; d <= today; d++) {
        const ds = `${thisMonthPrefix}-${String(d).padStart(2, '0')}`;
        days.push({ label: `${d}日`, value: byDate[ds] ? +byDate[ds].toFixed(2) : 0 });
      }

      if (monthly.length === 0) {
        showEmptyState('line-chart', '📉 本月暂无数据');
        return;
      }
      hideEmptyState('line-chart');

      inst.setOption({
        tooltip: { trigger: 'axis',
          backgroundColor: 'rgba(45, 55, 72, 0.95)', borderColor: 'transparent',
          textStyle: { color: '#fff', fontSize: 13 },
          formatter: (p) => `<strong>${thisMonthPrefix}-${p[0].axisValue.replace('日', '').padStart(2, '0')}</strong><br/>支出：<span style="color:#68d391">¥${p[0].value}</span>` },
        grid: { top: 20, bottom: 40, left: 60, right: 30 },
        xAxis: { type: 'category', data: days.map((d) => d.label), boundaryGap: false,
          axisLabel: { fontSize: 11, color: '#4a5568' }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
        yAxis: { type: 'value',
          axisLabel: { formatter: (v) => '¥' + v, fontSize: 11, color: '#718096' },
          splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } } },
        series: [{
          type: 'line', data: days.map((d) => d.value),
          smooth: true, symbol: 'circle', symbolSize: 8,
          itemStyle: { color: '#667eea', borderWidth: 2, borderColor: '#fff' },
          lineStyle: { width: 3, color: '#667eea' },
          areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(102, 126, 234, 0.4)' },
              { offset: 1, color: 'rgba(102, 126, 234, 0.02)' }] } },
          markPoint: { data: [{ type: 'max', name: '最高' }, { type: 'min', name: '最低' }] },
        }],
      }, true);

      inst.resize();
    },

    // ========== 4. 堆叠柱状图 ==========
    renderStackByMonth(filterCategory) {
      const inst = this.instances.stack;
      if (!inst) return;

      const expenses = getFilteredExpenses(filterCategory);
      const byMonth = {};
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
        showEmptyState('stack-chart', '📊 暂无数据<br>每月各类别分布将在此展示');
        return;
      }
      hideEmptyState('stack-chart');

      const series = categories.map((cat) => ({
        name: cat, type: 'bar', stack: 'expenses', barWidth: '55%',
        emphasis: { focus: 'series' },
        itemStyle: { color: global.Categories.getColorByName(cat) },
        data: months.map((m) => +(byMonth[m][cat] || 0).toFixed(2)),
      }));

      inst.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
          backgroundColor: 'rgba(45, 55, 72, 0.95)', borderColor: 'transparent',
          textStyle: { color: '#fff', fontSize: 13 },
          formatter: (params) => {
            const monthLabel = params[0].axisValue;
            const total = params.reduce((s, p) => s + (p.value || 0), 0).toFixed(2);
            let html = `<strong>${monthLabel}</strong><br/>`;
            params.forEach((p) => {
              if (p.value > 0) {
                html += `<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${p.color};margin-right:6px;"></span>${p.seriesName}：¥${p.value}<br/>`;
              }
            });
            html += `<span style="border-top:1px solid rgba(255,255,255,0.2);padding-top:4px;margin-top:4px;display:block;"><strong>总计：¥${total}</strong></span>`;
            return html;
          } },
        legend: { data: categories, top: 5,
          textStyle: { fontSize: 12, color: '#4a5568' }, itemWidth: 12, itemHeight: 12 },
        grid: { top: 50, bottom: 40, left: 60, right: 30 },
        xAxis: { type: 'category', data: months.map((m) => m.slice(5) + '月'),
          axisLabel: { fontSize: 12, color: '#4a5568' }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false } },
        yAxis: { type: 'value',
          axisLabel: { formatter: (v) => '¥' + v, fontSize: 11, color: '#718096' },
          splitLine: { lineStyle: { color: '#edf2f7', type: 'dashed' } } },
        series,
      }, true);

      inst.resize();
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
    dom.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#a0aec0;font-size:13px;text-align:center;flex-direction:column;gap:8px;">${html}</div>`;
  }

  function hideEmptyState(containerId) { /* ECharts setOption 会覆盖 DOM */ }

  function showDegraded(containerId, html) {
    const dom = document.getElementById(containerId);
    if (dom) {
      dom.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#e53e3e;font-size:13px;text-align:center;">${html}</div>`;
    }
  }

  global.charts = charts;
})(window);
