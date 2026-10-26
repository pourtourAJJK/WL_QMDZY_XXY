# Iteration 6 — 认证模块（登录/注册/锁定）

**Date:** 2026-10-26
**Branch:** `feature/auth-login` → merge to `main`
**Story:** 新增登录路由 + 账户校验 + 5 次错误锁定 5 分钟

## 改动说明

| 文件 | 改动 |
|------|------|
| `src/js/auth.js` | **新增**。完整认证模块：注册/登录/登出/锁定检查/路由守卫/视图切换 |
| `src/index.html` | **重写**。加登录视图容器、dashboard-container 加 id、header 加登出按钮+用户信息、script 顺序 auth.js 提前 |
| `src/js/main.js` | **重写**。加 auth 初始化优先 + global.onAuthReady 回调 + 登录后才初始化业务模块 |
| `src/css/style.css` | **更新**。header 改左右布局 + 新增登录页全套样式（login-card, auth-tab, auth-form 等） |

## 技术决策

### 1. 为什么用 SHA-256 哈希存密码？
- 纯前端环境下，Web Crypto API（`crypto.subtle.digest('SHA-256')`）是浏览器原生安全哈希方式
- 密码哈希存 localStorage，即使 localStorage 被读取也看不到明文
- 注册时生成：`hash = sha256(password)` → 存 `{ username: { passwordHash } }`
- 登录时生成：`inputHash = sha256(inputPassword)` → 和存储的哈希做 `===` 对比

### 2. 为什么锁定状态存 localStorage 而不是内存？
- 防止用户通过**刷新页面绕过锁定**——如果锁定存在内存里，刷新就清零了
- localStorage key 带 username 后缀：`auth_lock:admin`、`auth_lock:alice`，每个账号独立锁定
- 锁定时间戳：`lockedUntil = Date.now() + 5*60*1000`（5 分钟后），登录前先检查

### 3. 为什么登录态用 sessionStorage 而不是 localStorage？
- sessionStorage 在**浏览器关闭后自动清除**，下次打开需要重新登录
- localStorage 会持久化到手动清除——对于个人开销数据，关闭浏览器即退出更安全
- 这符合"私密数据"的直觉预期

### 4. 为什么 main.js 要拆成两步初始化？
- auth 模块必须**最先初始化**（决定显示登录页还是仪表盘）
- 业务模块（ECharts、form、listView）只有在登录后才有意义初始化
- 用 `global.onAuthReady()` 回调实现解耦——auth.js 登录成功时调它，main.js 在 DOM ready 时注册它

### 5. 路由守卫
- 简单 hash 路由：`#login` 和 `#dashboard`
- auth.init() 里根据 `auth.isLoggedIn()` 自动调用 showLogin() 或 showDashboard()
- 监听 hashchange：未登录时访问 `#dashboard` 自动跳回 `#login`

## 核心功能点

### 5 次错误锁定 5 分钟
```js
// 每次登录失败：
recordFailedAttempt(username);  // failedAttempts += 1

// 第 5 次时：
if (state.failedAttempts >= 5) {
  state.lockedUntil = Date.now() + 5 * 60 * 1000;  // 写死 5 分钟
}

// 登录前检查：
if (isLocked(username)) return { reason: '该账号已被锁定，请 X 分钟后重试' };
```
- 锁定倒计时实时显示（每秒更新）
- 锁定期过了自动清除，下次登录从零计次

### 账户注册
- 校验：账号 ≥ 3 位、密码 ≥ 6 位、两次密码一致
- 不允许重复账号
- 注册成功后提示"请去登录"，3 秒后切回登录 tab

### 登录成功
- 清除该账号的失败记录
- 生成随机 32 位 token + 时间戳存入 sessionStorage
- 切到仪表盘视图 → 触发 onAuthReady → 初始化业务模块

### 登出
- sessionStorage 里的 token 清除
- 切回登录视图

## 验证结果

- [x] 首次打开页面显示登录卡片（仪表盘隐藏）
- [x] 注册新账户成功，登录页自动填入账号
- [x] 输入错误密码：提示"账号或密码错误，还剩 4 次尝试机会"
- [x] 连续输错 5 次：提示"账号已被锁定，请 5 分钟后重试"
- [x] 锁定状态持久化：刷新浏览器仍然锁定（倒计时持续）
- [x] 登录成功：显示仪表盘 + 右上角当前用户名
- [x] 关闭浏览器重开：回到登录页（sessionStorage 清除）
- [x] 登出按钮：回到登录页
- [x] localStorage 里存的是密码哈希（64 位 hex 字符串），不是明文
- [x] 锁定状态用 `auth_lock:username` key 存，不同账号独立

## 安全约束回顾

| 约束 | 实现 |
|------|------|
| 密码不明文存储 | ✅ SHA-256 哈希后存 localStorage |
| 锁定防刷新绕过 | ✅ 锁定状态存 localStorage（非内存） |
| 登录态安全 | ✅ sessionStorage（关闭浏览器即退出） |
| 账户唯一性 | ✅ 注册时检查 accountExists() |
| 跨账号锁定独立 | ✅ key 带 username 后缀 |

## 已知局限

- 纯前端方案无法真正防暴力破解（用户可以在 DevTools 里直接看 localStorage 里的哈希然后比对）—— 课程大作业场景下是可接受的 demo 级安全，生产环境必须有后端服务端校验
- 没有"忘记密码"功能
- 锁定时长（5 分钟）和最大错误次数（5 次）是硬编码常量，没有配置化
- 没有账户删除功能
