/**
 * auth.js — 前端 mock 认证模块（注册/登录/锁定/登出/路由守卫）
 * Feature: feature/auth-login
 * 安全约束：
 *   1. 密码用 Web Crypto SHA-256 哈希存 localStorage，不明文保存
 *   2. 锁定状态持久化（localStorage），防止刷新绕过
 *   3. 登录态用 sessionStorage（关闭浏览器即退出，比 localStorage 更安全）
 */
(function (global) {
  'use strict';

  // ============ storage keys ============
  const ACCOUNTS_KEY = 'auth_accounts';           // { username: { passwordHash, createdAt } }
  const LOCK_KEY = 'auth_lock';                   // { username, failedAttempts, lockedUntil }
  const SESSION_KEY = 'auth_session';             // { token, username, createdAt }

  const MAX_FAILED_ATTEMPTS = 5;
  const LOCK_DURATION_MS = 5 * 60 * 1000;         // 5 分钟

  // ============ public API ============

  const auth = {
    /** 初始化：绑定 DOM 事件、恢复登录态、路由守卫 */
    init() {
      // 绑定登录/注册按钮
      this.bindLoginForm();
      this.bindRegisterForm();
      this.bindLogout();

      // 路由守卫：根据登录态切换视图
      if (this.isLoggedIn()) {
        this.showDashboard();
      } else {
        this.showLogin();
      }

      // 监听 hash 变化支持简单路由
      window.addEventListener('hashchange', () => this.route());
      console.log('[auth] initialized');
    },

    /** 路由守卫：hash 变化时检查登录态 */
    route() {
      const hash = window.location.hash || '#login';
      if (hash === '#dashboard' && !this.isLoggedIn()) {
        window.location.hash = '#login';
        this.showLogin();
      } else if (hash === '#login' && this.isLoggedIn()) {
        window.location.hash = '#dashboard';
        this.showDashboard();
      }
    },

    /** 注册新账户 */
    async register(username, password) {
      username = (username || '').trim();
      password = (password || '').trim();

      if (!username || !password) return { ok: false, reason: '账号和密码不能为空' };
      if (username.length < 3) return { ok: false, reason: '账号至少 3 位' };
      if (password.length < 6) return { ok: false, reason: '密码至少 6 位' };
      if (this.isLocked(username)) return { ok: false, reason: `该账号已被锁定，请${this.getLockRemaining(username)}后重试` };
      if (this.accountExists(username)) return { ok: false, reason: '该账号已存在' };

      const passwordHash = await this.sha256(password);
      const accounts = this.loadAccounts();
      accounts[username] = { passwordHash, createdAt: Date.now() };
      this.saveAccounts(accounts);

      console.log('[auth] registered:', username);
      return { ok: true };
    },

    /** 登录 */
    async login(username, password) {
      username = (username || '').trim();
      password = (password || '').trim();

      if (!username || !password) return { ok: false, reason: '请输入账号和密码' };

      // 1. 检查锁定状态
      if (this.isLocked(username)) {
        const remaining = this.getLockRemaining(username);
        return { ok: false, reason: `该账号已被锁定，请${remaining}后重试` };
      }

      // 2. 检查账户是否存在
      if (!this.accountExists(username)) {
        this.recordFailedAttempt(username);
        return { ok: false, reason: '账号或密码错误' };
      }

      // 3. 校验密码（哈希对比）
      const accounts = this.loadAccounts();
      const inputHash = await this.sha256(password);
      if (inputHash !== accounts[username].passwordHash) {
        const state = this.recordFailedAttempt(username);
        const remaining = this.getLockRemaining(username);
        if (state.locked) {
          return { ok: false, reason: `密码错误次数过多，账号已被锁定，请${remaining}后重试` };
        } else {
          const left = MAX_FAILED_ATTEMPTS - state.failedAttempts;
          return { ok: false, reason: `账号或密码错误，还剩 ${left} 次尝试机会` };
        }
      }

      // 4. 登录成功：清除失败记录，创建 session
      this.clearFailedAttempts(username);
      const token = this.generateToken();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        token,
        username,
        createdAt: Date.now(),
      }));

      console.log('[auth] logged in:', username);
      return { ok: true, username };
    },

    /** 登出 */
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.hash = '#login';
      this.showLogin();
      console.log('[auth] logged out');
    },

    /** 是否已登录（只检查 sessionStorage 里是否有 token） */
    isLoggedIn() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return false;
        const session = JSON.parse(raw);
        return !!session.token && !!session.username;
      } catch (e) {
        return false;
      }
    },

    /** 获取当前登录用户名 */
    getCurrentUser() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw).username : null;
      } catch (e) {
        return null;
      }
    },

    /** 锁定状态检查 */
    isLocked(username) {
      const state = this.loadLockState(username);
      if (!state) return false;
      if (state.lockedUntil > Date.now()) return true;
      // 锁定期过了，清除状态
      this.clearLockState(username);
      return false;
    },

    /** 获取锁定剩余时间（"X 分钟" / "X 秒" 格式） */
    getLockRemaining(username) {
      const state = this.loadLockState(username);
      if (!state || state.lockedUntil <= Date.now()) return '';
      const ms = state.lockedUntil - Date.now();
      const seconds = Math.ceil(ms / 1000);
      if (seconds >= 60) return `${Math.ceil(seconds / 60)} 分钟`;
      return `${seconds} 秒`;
    },

    // ============ DOM 切换 ============

    showLogin() {
      const loginView = document.getElementById('login-view');
      const dashboard = document.getElementById('dashboard-container');
      if (loginView) loginView.style.display = 'flex';
      if (dashboard) dashboard.style.display = 'none';
      if (!window.location.hash || window.location.hash === '#dashboard') {
        window.location.hash = '#login';
      }
    },

    showDashboard() {
      const loginView = document.getElementById('login-view');
      const dashboard = document.getElementById('dashboard-container');
      if (loginView) loginView.style.display = 'none';
      if (dashboard) dashboard.style.display = 'block';
      window.location.hash = '#dashboard';
      // 触发 main.js 的初始化
      if (global.onAuthReady) global.onAuthReady();
    },

    // ============ 内部：DOM 事件绑定 ============

    bindLoginForm() {
      const form = document.getElementById('login-form');
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      const msg = document.getElementById('login-message');
      const lockInfo = document.getElementById('login-lock-info');

      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = '';
        msg.className = 'auth-message';
        lockInfo.style.display = 'none';

        const result = await this.login(usernameInput.value, passwordInput.value);
        if (!result.ok) {
          msg.textContent = result.reason;
          msg.classList.add('error');
          // 显示锁定倒计时
          if (result.reason.includes('锁定')) {
            lockInfo.style.display = 'block';
            this.startCountdown(usernameInput.value.trim());
          }
        } else {
          msg.textContent = '登录成功！';
          msg.classList.add('success');
          setTimeout(() => this.showDashboard(), 300);
        }
      });

      // 锁定状态实时检查
      usernameInput?.addEventListener('blur', () => {
        const u = usernameInput.value.trim();
        if (u && this.isLocked(u)) {
          lockInfo.style.display = 'block';
          this.startCountdown(u);
        } else {
          lockInfo.style.display = 'none';
        }
      });
    },

    bindRegisterForm() {
      const form = document.getElementById('register-form');
      const msg = document.getElementById('register-message');
      const switchLink = document.getElementById('switch-to-register');
      const backLink = document.getElementById('switch-to-login');

      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = '';
        msg.className = 'auth-message';

        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;

        if (password !== confirm) {
          msg.textContent = '两次输入的密码不一致';
          msg.classList.add('error');
          return;
        }

        const result = await this.register(username, password);
        if (!result.ok) {
          msg.textContent = result.reason;
          msg.classList.add('error');
        } else {
          msg.textContent = '注册成功！请去登录';
          msg.classList.add('success');
          // 3 秒后切回登录表单
          setTimeout(() => {
            document.getElementById('login-username').value = username;
            switchTab('login-tab');
          }, 1500);
        }
      });

      // tab 切换
      switchLink?.addEventListener('click', () => switchTab('register-tab'));
      backLink?.addEventListener('click', () => switchTab('login-tab'));
    },

    bindLogout() {
      const btn = document.getElementById('logout-btn');
      if (btn) btn.addEventListener('click', () => this.logout());
    },

    startCountdown(username) {
      const lockInfo = document.getElementById('login-lock-info');
      if (!lockInfo) return;

      const state = this.loadLockState(username);
      if (!state || state.lockedUntil <= Date.now()) {
        lockInfo.style.display = 'none';
        return;
      }

      const update = () => {
        const remaining = state.lockedUntil - Date.now();
        if (remaining <= 0) {
          lockInfo.style.display = 'none';
          return;
        }
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        lockInfo.innerHTML = `🔒 账号已锁定，剩余 <strong>${minutes}分${seconds}秒</strong>`;
      };
      update();
      const timer = setInterval(() => {
        if (lockInfo.style.display === 'none') clearInterval(timer);
        else update();
      }, 1000);
    },

    // ============ 内部：账户/锁定持久化 ============

    loadAccounts() {
      try {
        return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
      } catch (e) {
        return {};
      }
    },

    saveAccounts(accounts) {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    },

    accountExists(username) {
      const accounts = this.loadAccounts();
      return !!accounts[username];
    },

    recordFailedAttempt(username) {
      let state = this.loadLockState(username) || { failedAttempts: 0, lockedUntil: 0 };
      state.failedAttempts += 1;
      let locked = false;
      if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        state.lockedUntil = Date.now() + LOCK_DURATION_MS;
        locked = true;
      }
      localStorage.setItem(LOCK_KEY + ':' + username, JSON.stringify(state));
      return { ...state, locked };
    },

    clearFailedAttempts(username) {
      localStorage.removeItem(LOCK_KEY + ':' + username);
    },

    loadLockState(username) {
      try {
        const raw = localStorage.getItem(LOCK_KEY + ':' + username);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    clearLockState(username) {
      localStorage.removeItem(LOCK_KEY + ':' + username);
    },

    // ============ 内部：工具函数 ============

    /** Web Crypto SHA-256 哈希 */
    async sha256(str) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    },

    /** 生成随机 token（基础安全） */
    generateToken() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token + '_' + Date.now();
    },
  };

  // ============ 内部：tab 切换 ============

  function switchTab(tabId) {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMsg = document.getElementById('login-message');
    const registerMsg = document.getElementById('register-message');
    const lockInfo = document.getElementById('login-lock-info');

    loginMsg.textContent = '';
    registerMsg.textContent = '';
    lockInfo.style.display = 'none';

    if (tabId === 'login-tab') {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
    } else {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerForm.style.display = 'block';
      loginForm.style.display = 'none';
    }
  }

  // 暴露到 window
  global.auth = auth;
  global.switchAuthTab = switchTab;
})(window);
