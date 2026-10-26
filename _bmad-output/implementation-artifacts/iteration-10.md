# Iteration 10 — 彻底修复图表白屏 + 账号持久化

**Date:** 2026-10-26
**Branch:** `feature/fix-chart-promise-auth-persist` → merge to `main`

## 问题描述（两个）

### 问题 1：每次换端口账号丢失
用户反馈每次都要重新注册账号和重新录入数据。

**根因：** localStorage 按 origin（协议+域名+端口）隔离。每次预览换端口（8081→8082→8100...）= 换 origin = localStorage 全新空。

**修复：** 固定预览端口为 8080，永远不再换。

### 问题 2：图表还是白屏（列表有数据）
用户截图显示开销明细列表有 9 条数据（2019-2026 都有），但四个图表容器全显示"暂无数据"。console 显示 init 和 refreshAll 都执行成功。

**根因：** `charts.init()` 用双 requestAnimationFrame 异步创建实例，但 main.js 同步调 `initBusinessModules()` 后立即调 `renderer.refreshAll()`——此时 instances 还是空的。虽然 refreshAll 有 `setTimeout 100ms` 重试机制，但这种 "fire and forget" 的重试很脆弱（取决于 setTimeout 和 rAF 谁先跑完）。

**修复：** `charts.init()` 改成**返回 Promise**，main.js 用 `async function initBusinessModules()` + `await charts.init()` 等 Promise resolve 后再调 refreshAll。彻底消除竞态——instances 一定已就绪。

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/charts.js` | init() 返回 new Promise((resolve) => {...})，rAF 回调末尾 resolve(true)；加调试日志 `[charts] dataStore.getAll() returned: N expenses` |
| `src/js/main.js` | initBusinessModules 改 async，`await charts.init()` 等实例就绪后再调 refreshAll |
| 预览端口 | **固定 8080**，不再换 |

## 技术决策：为什么 Promise + await？

之前的修复用 `setTimeout 100ms` 重试：
```js
if (!instancesReady) {
  setTimeout(() => this.refreshAll(filterCategory), 100); // 100ms 后重试
}
```
问题：
- 100ms 是 magic number——如果设备慢或浏览器忙，rAF 可能还没跑完
- 最多重试 5 次，任何一次超时都可能导致图表不渲染
- 调试困难——到底是 init 慢还是其他问题？

Promise + await 方案：
```js
// charts.init() 返回 Promise：
init() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        echarts.init(dom);
        ...
        resolve(true); // ← 精确知道什么时候 init 完了
      });
    });
  });
}

// main.js await：
async function initBusinessModules() {
  await charts.init();      // ← 精确等 init 完
  renderer.refreshAll();    // ← 此时 instances 一定就绪
}
```
优势：
- **彻底消除竞态**：await 后 instances 100% 已就绪
- **无 magic number**：不依赖 setTimeout 100ms 这种拍脑袋数字
- **错误可追踪**：Promise reject 可以 catch 到 echarts.init 真正的异常
- **代码语义清晰**：await 就是在说"等初始化完成再继续"

## 验证步骤

1. 启动服务器：固定用 `npx serve src -p 8080`（永远 8080）
2. Ctrl+Shift+R 强制刷新浏览器（清旧 JS 缓存）
3. 注册新账号（或之前已注册 → 直接登录）
4. 登录后看 console 输出：
   ```
   [charts] ✅ initialized. instances: pie, bar, line, stack
   [charts] dataStore.getAll() returned: N expenses   ← 这里 N 应该 > 0
   [main] ECharts instances created ✅
   [charts] 🎨 all charts refreshed
   ```
5. 四个图表全部正确渲染

## 关于 localStorage 跨端口隔离

这是浏览器安全机制，**不是 bug**。生产环境下你应该：
- 用固定的开发端口（8080 永远不变）
- 或直接双击 src/index.html 用 file:// 打开（file:// 只有一个 origin，数据永远不丢）

本项目后续所有预览都固定用 **8080 端口**。

## 已知局限

- 固定端口 8080 如果被占用需要手动 kill（`Get-Process node | Stop-Process`）
- Promise + async/await 在 IE 浏览器不支持（课程大作业用 Chrome/Edge 没问题）
