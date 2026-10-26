# Iteration 8 — 图表可视化增强（修复 + 视觉升级 + 新增堆叠图）

**Date:** 2026-10-26
**Branch:** `feature/chart-enhancement` → merge to `main`
**改动：** 三管齐下 — 修 bug + 视觉增强 + 新增图表

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/charts.js` | **全面重写**。init() 加 echarts 检查+延迟；环形图加中心数字+百分比label+动画；柱状图加渐变+hover联动；新增 renderStackByMonth() 月度类别堆叠柱状图 |
| `src/index.html` | **更新**。图表区加堆叠图容器 `#chart-stack`，调整容器顺序 |
| `src/css/style.css` | **更新**。stack-chart 容器高度 320px（堆叠图需要更多空间） |

## 1. Bug 修复（echarts 竞态）

### 问题
原 charts.init() 在 DOM ready 后立即调用 echarts.init()，但 ECharts CDN 可能还没加载完，导致 `echarts is undefined`。

### 修复
```js
init() {
  // 先检查 echarts 是否存在
  if (typeof global.echarts === 'undefined') {
    console.error('[charts] echarts not loaded!');
    return false;
  }
  // 延迟 50ms init，确保 CDN script 执行完
  setTimeout(() => { ... 真正 init ... }, 50);
}
```

### 同时修复 refreshAll 时序
```js
refreshAll() {
  if (!this.instances.pie && !this.instances.bar) {
    setTimeout(() => this.refreshAll(filterCategory), 100); // 延迟重试
    return;
  }
  ...
}
```

## 2. 环形图视觉增强

| 改动 | 实现 |
|------|------|
| **中心总金额** | `graphic` 组件：两行 text，第一行大字 ¥XXX，第二行"累计总支出" |
| **百分比 label** | `label.formatter: (p) => p.name + '\n' + p.percent + '%'`，外部显示 |
| **扇区排序** | 按金额降序，视觉从大到小更清晰 |
| **动画** | `animationType: 'scale'`, `animationEasing: 'elasticOut'`, 逐扇 delay 80ms |
| **Emphasis 放大** | `emphasis.scaleSize: 10` + `shadowBlur` 阴影 |
| **扇区缝隙** | `padAngle: 1.5` + 圆角 `borderRadius: 8` |
| **Tooltip 美化** | 深色半透明背景 + 格式化金额 + 百分比次级灰色 |

## 3. 柱状图视觉增强

| 改动 | 实现 |
|------|------|
| **三段渐变色带** | colorStops: #667eea → #8b7cf6 → #764ba2 |
| **Hover 联动高亮** | `emphasis.focus: 'series'`（其他柱变灰） |
| **Tooltip 阴影指针** | `axisPointer.type: 'shadow'` + 淡紫色底色 |
| **标题数字加粗** | `label.fontWeight: 'bold'`, `fontSize: 12` |
| **顶部圆角** | `borderRadius: [6, 6, 0, 0]` |
| **平滑动画** | `animationDuration: 800`, `animationEasing: 'cubicOut'` |
| **网格线** | Y 轴用 dashed 虚线，X 轴只保留底部 axisLine |

## 4. 折线图微调

| 改动 | 实现 |
|------|------|
| **Hover 联动** | `emphasis.focus: 'series'` |
| **标记点** | `markPoint: { type: 'max'/'min' }` 自动标注最高/最低日 |
| **数据点圆点边框** | `itemStyle: { borderWidth: 2, borderColor: '#fff' }` |

## 5. 新增：月度类别堆叠柱状图

### 为什么？
原来的三张图回答了：
- 钱花到哪了？（环形图）
- 每月花多少？（柱状图）
- 本月每天花多少？（折线图）

但**没回答**：**"每个月的消费结构是什么？餐饮占比越来越大还是购物越来越大？"**

堆叠柱状图完美填补这个缺口 —— 每个月一根柱子，颜色段 = 各类别支出：
- 一眼看到每个月花多少钱
- 同时看到这个月钱花到了哪些类别
- 跨月对比消费结构变化

### 实现细节
```js
// 1. 二维聚合：byMonth[月份][类别] = 金额
// 2. 每个类别一个 series，都 stack: 'expenses'
// 3. 颜色用 Categories.getColorByName(cat) —— 与环形图一致
// 4. Tooltip 自己拼 HTML：列出每个类别 + 最后一行"总计"
```

### Tooltip 特色
```
2026年10月
■ 餐饮：¥500
■ 购物：¥300
■ 交通：¥80
──────────
总计：¥880
```
用小色块（inline-block）+ Categories 颜色，视觉上和图例一致。

## 验证结果

- [x] 登录后控制台显示 `[charts] initialized ✅`，无 `echarts is undefined` 错误
- [x] 环形图中心显示总金额大字 + 小字说明
- [x] 环形图每个扇区 label 显示"类别名 + 百分比"
- [x] 环形图 hover 时该扇区放大+阴影，其他变淡
- [x] 柱状图有三段渐变色带，hover 时该柱高亮其他变灰
- [x] 折线图有 markPoint 标注最高/最低
- [x] 堆叠柱状图渲染成功（需要至少 2 个月份有数据且至少 2 个类别）
- [x] 堆叠图每段颜色与 Categories.getColorByName() 一致
- [x] 堆叠图 tooltip 显示各类别明细 + 总计
- [x] filterCategory 筛选时四张图同步刷新（堆叠图也会过滤）
- [x] 窗口 resize 时四张图自适应

## 已知局限

- 堆叠柱状图的 tooltip 总计是手动算的（`reduce`），不是 ECharts 内置功能——简单可靠但如果未来加多 series 需要同步修改
- 堆叠图圆角简化为直角（堆叠时圆角需要每个 series 只给顶部/底部圆角，复杂度较高，课程大作业场景下先省略）
- echarts 延迟 init 是 `setTimeout 50ms` 的脏方案，更优雅的做法是 `window.addEventListener('load', ...)` 或 `echarts.init` 用 try/catch + 重试
