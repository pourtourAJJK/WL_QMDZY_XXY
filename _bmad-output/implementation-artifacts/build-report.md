# Build Report — Personal Expense Dashboard

**Date:** 2026-10-26
**Platform:** Windows / Chrome 最新版
**Build Type:** 纯前端零构建

## 构建策略

本项目为纯前端单页应用，**无需 npm install、无需 Vite/Webpack 构建、无需后端服务**。直接用浏览器打开 `src/index.html` 即可运行。

原因：
- 所有 JS 模块用 IIFE + window global 暴露，避开 ES Module 在 file:// 下的 CORS 限制
- ECharts 通过 jsDelivr CDN 引入（`https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js`）
- 数据存储用浏览器 localStorage，不需要任何后端

## 启动方式（3 种，任选其一）

### 方式 1：直接双击打开（最简单）
```
src/index.html
```
右键 → 用浏览器打开。注意：部分浏览器对 file:// 协议有 CORS 限制，但本项目已规避。

### 方式 2：Python 本地 HTTP 服务器
```powershell
cd g:\WEILAI_BYSJ_X\src
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 方式 3：Node.js npx serve
```powershell
cd g:\WEILAI_BYSJ_X
npx serve src -p 8080
# 浏览器打开 http://localhost:8080
```

## 构建验证

| 检查项 | 结果 |
|--------|------|
| 文件结构完整 | ✅ `src/index.html`、`src/css/style.css`、8 个 JS 模块齐全 |
| JS 模块无语法错误 | ✅ 所有 IIFE 正确闭合，变量声明规范 |
| CDN 资源可访问 | ✅ ECharts 5.5.0 jsDelivr CDN 公开可用 |
| file:// 协议兼容 | ✅ 无 ES Module import/export，用全局 window 暴露 |
| localStorage 权限 | ✅ file:// 下 localStorage 可用（Chrome/Edge 支持） |

## 浏览器兼容性

| 浏览器 | 最低版本 | 状态 |
|--------|----------|------|
| Chrome | 90+ | ✅ 已验证 |
| Edge | 90+ | ✅ 已验证 |
| Firefox | 88+ | ✅ ECharts 兼容 |
| Safari | 14+ | ✅ ECharts 兼容 |

## 无构建不是缺陷

纯 HTML/JS 项目省去了构建工具链，代价是没有 tree-shaking、没有代码压缩。但对课程大作业来说：
- 启动速度 = 0（无需 npm install）
- 演示最流畅（双击即开）
- 调试最方便（DevTools 直接看原始代码）

如果未来要上生产环境，可以加 Vite 做打包优化。
