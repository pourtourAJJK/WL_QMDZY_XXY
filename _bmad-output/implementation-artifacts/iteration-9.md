# Iteration 9 — 修复图表白屏 Bug（时序 + 重复调用）

**Date:** 2026-10-26
**Branch:** `feature/fix-chart-render` → merge to `main`

## 问题描述

用户打开应用后，开销明细列表正常显示数据（11 条），但**所有四个 ECharts 图表容器全白**（只有标题文字）。数据在 localStorage 里有，列表能读取渲染，但图表全部空白。

## 根因分析（两层）

### 根因 1：onAuthReady 被调两次

main.js 在 DOMContentLoaded 里：
```js
// auth.init() 内部已通过 showDashboard() 调了 onAuthReady()
global.auth.init();

// 然后又主动调了一次！
if (global.auth && global.auth.isLoggedIn()) {
  global.onAuthReady(); // 💥 重复调用
}
```

导致 initBusinessModules() 执行**两次**：
- 第一次：charts.init() 启动 setTimeout(50ms)，return true
- 第二次：charts.init() 又启动 setTimeout(50ms)
- 两个 setTimeout 都在 50ms 后执行，可能互相覆盖实例

### 根因 2：ECharts init 时序

charts.init() 用 setTimeout(50ms) 延迟，理论上能覆盖 CDN 加载。但更微妙的是：
- auth.showDashboard() 把 `dashboard-container.style.display` 从 `none` 切到 `block`
- 紧接着 initBusinessModules() → charts.init() → setTimeout(50ms)
- 50ms 后 echarts.init(dom) 执行时，**浏览器可能还没完成 layout 计算**（display:none → block 的 layout reflow 通常需要一帧 ~16ms）
- echarts.init() 拿到 0×0 尺寸的容器 → 创建了实例但渲染区域为 0 → 图表不可见！

## 修复方案

### 修 main.js：防重复调用

```js
let _businessModulesInited = false; // 一次性标志

global.onAuthReady = () => {
  if (_businessModulesInited) {
    console.warn('[main] already inited, skipping');
    return;
  }
  _businessModulesInited = true;
  ...
};

// 删除 DOMContentLoaded 里的二次调用！
```

### 修 charts.js：彻底重写 init()

| 问题 | 修复 |
|------|------|
| setTimeout(50ms) 不确定 | 用 **双 requestAnimationFrame** 等待两帧（确保 layout 完成） |
| init 后没 resize | init 后 setTimeout(10ms) + 每个 render 方法末尾都 inst.resize() |
| instances 被覆盖 | init() 开头先 `this.instances = {}` 重置 |
| 重试无限循环 | refreshAll 加 `_MAX_RETRY = 5` 限制 |
| echarts 未加载时静默 | 给每个图表容器写降级提示 HTML |
| init 完没自动 refresh | init 最后检查 `this._pendingFilter` 并自动刷新 |

### requestAnimationFrame 双帧方案

```js
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // 此时浏览器已完成 layout（两帧 ~32ms 以上）
    // display:none → block 的容器尺寸已正确计算
    echarts.init(dom);
  });
});
```

为什么双 rAF？单 rAF 时 display:none → block 的 layout 可能还没计算；双 rAF 确保浏览器有充足时间完成 reflow。

## 验证结果

- [x] 登录后控制台只显示一次 `[main] Auth ready — initializing business modules...`（不再重复）
- [x] 控制台显示 `[charts] ✅ initialized. instances: pie, bar, line, stack`
- [x] 控制台显示 `[charts] 🎨 all charts refreshed`
- [x] 四个图表全部正确渲染（环形图/柱状图/堆叠图/折线图）
- [x] 中心总金额/百分比 label/渐变色带等视觉增强全部显示
- [x] 筛选下拉框切换时图表同步刷新

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/js/main.js` | 删除重复 onAuthReady + 加 `_businessModulesInited` 防重入 |
| `src/js/charts.js` | 彻底重写：init() 改 rAF 双帧 + 手动 resize；refreshAll 加重试上限；每个 render 末尾加 inst.resize()；echarts 降级提示 |

## 经验教训

> "setTimeout 延迟不是万能的。对依赖浏览器 layout 的操作（如 echarts.init 对尺寸敏感），requestAnimationFrame 更可靠。display:none → block 后 ECharts init 会拿到 0 尺寸，**必须等一帧以上**。"

> "防止模块初始化被调两次 — 加一次性标志位（_inited = false → true）是成本最低、最有效的保险。"
