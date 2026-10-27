# Iteration 17 — ECharts 改为本地加载，修复 CDN 故障引发的认证崩溃

**Date:** 2026-10-27
**Branch:** `feature/local-echarts` → merge to `main`（`276545a`）
**类型:** 缺陷修复（浏览器控制台报 `ERR_CONNECTION_RESET` + `TypeError: Cannot read properties of undefined (reading 'getTokens')`）

## 问题描述

用户打开前端页面后控制台出现两条报错：

```
echarts.min.js:1 Failed to load resource: net::ERR_CONNECTION_RESET
auth.js:132 Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'getTokens')
```

## 根因分析

1. **jsdelivr CDN 被重置**：`cdn.jsdelivr.net/npm/echarts@5.5.0/...` 连接被重置，ECharts 脚本加载失败。
2. **`document.write` 回退的副作用**：原代码在 CDN 失败时用 `document.write` 注入 bootcdn 备用脚本；该注入可能阻断 / 干扰后续业务脚本（`api.js`）的正常执行，导致 `global.api` 未挂载。
3. **`auth.js` 第 132 行崩溃**：`isLoggedIn()` 直接调用 `global.api.getTokens()`，`global.api` 为 undefined 时抛 TypeError，Promise 未捕获，初始化流程中断。

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/vendor/echarts.min.js` | 从 bootcdn 下载 ECharts 5.5.0（1,029,203 字节）存入仓库，彻底摆脱第三方 CDN 可用性风险 |
| `src/index.html` | 移除 jsdelivr CDN 引用与 `document.write` 回退，改为 `<script src="js/vendor/echarts.min.js?v=20261027b">`；全部静态资源版本号 `?v=20261027` → `?v=20261027b`，防止浏览器沿用旧缓存 |
| `src/js/auth.js` | `isLoggedIn()` 增加防御性检查：`global.api` 不存在时打印错误并返回 false，不再抛 TypeError |

## 验证结果

- 浏览器侧全部脚本（echarts / api / auth / 各业务模块）请求均 200，控制台无报错
- 登录 → 录入 → 四张图表渲染与刷新正常
- 后端单测 **35/35 PASS**（本次未改后端逻辑，回归确认）

## 已知局限

- `src/js/vendor/echarts.min.js` 被 `.gitignore` 的 `*.min.js` 规则匹配，需 `git add -f` 强制纳入（仓库中有意保留该规则，故未加例外）
- ECharts 版本固定为 5.5.0，后续升级需手动替换文件
