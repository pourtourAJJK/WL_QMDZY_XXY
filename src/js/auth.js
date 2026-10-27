/**
 * auth.js — 后端认证模块（注册 / 登录 / JWT 会话 / 登出 / 路由守卫）
 *
 * 与旧版差异：
 *   1. 不再读写 localStorage 账号与锁定状态，全部逻辑由 Django 后端承担；
 *   2. 密码只提交给后端，前端不做 SHA-256，不落任何密码派生值；
 *   3. 会话凭 JWT（access 30min / refresh 1d），令牌存 sessionStorage；
 *   4. 连续失败 5 次锁定 5 分钟由服务端判定，前端仅展示 retry_after 倒计时。
 */
(function (global) {
  'use strict';

  const LEGACY_ACCOUNTS_KEY = 'auth_accounts';
  const LEGACY_LOCK_PREFIX = 'auth_lock';

  const auth = {
    /** 初始化：清理旧版本地数据 → 绑定 DOM → 路由守卫 */
    async init() {
      this.purgeLegacyLocalAuth();
      this.bindLoginForm();
      this.bindRegisterForm();
      this.bindLogout();

      window.addEventListener('hashchange', () => this.route());

      const restored = await this.restoreSession();
      if (restored) {
        this.showDashboard();
      } else {
        this.showLogin();
      }
      console.log('[auth] initialized (backend mode)');
    },

    /** 用现有 access 向后端校验会话是否仍然有效 */
    async restoreSession() {
      if (!this.isLoggedIn()) return false;
      try {
        const me = await global.api.request('/api/auth/me/');
        const tokens = global.api.getTokens();
        global.api.setTokens({ ...tokens, username: me.username });
        return true;
      } catch (e) {
        global.api.setTokens(null);
        return false;
      }
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

    /** 注册：仅提交账号密码，哈希与存储全在后端 */
    async register(username, password) {
      username = (username || '').trim();
      password = password || '';

      if (!username || !password) return { ok: false, reason: '账号和密码不能为空' };
      if (username.length < 3) return { ok: false, reason: '账号至少 3 位' };
      if (password.length < 6) return { ok: false, reason: '密码至少 6 位' };

      try {
        await global.api.request('/api/auth/register/', {
          method: 'POST',
          body: { username, password },
          auth: false,
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, reason: this.describeError(err) };
      }
    },

    /** 登录：成功后保存 JWT，失败时展示服务端返回的剩余次数/锁定倒计时 */
    async login(username, password) {
      username = (username || '').trim();
      password = password || '';
      if (!username || !password) return { ok: false, reason: '请输入账号和密码' };

      try {
        const data = await global.api.request('/api/auth/login/', {
          method: 'POST',
          body: { username, password },
          auth: false,
        });
        global.api.setTokens({
          access: data.access,
          refresh: data.refresh,
          username: data.username,
        });
        console.log('[auth] logged in:', data.username);
        return { ok: true, username: data.username };
      } catch (err) {
        return {
          ok: false,
          reason: this.describeError(err),
          retryAfter: err.data && err.data.retry_after,
          remaining: err.data && err.data.remaining_attempts,
        };
      }
    },

    /** 登出：通知后端拉黑 refresh，再清本地令牌 */
    async logout() {
      const tokens = global.api.getTokens();
      if (tokens && tokens.refresh) {
        try {
          await global.api.request('/api/auth/logout/', {
            method: 'POST',
            body: { refresh: tokens.refresh },
          });
        } catch (e) {
          console.warn('[auth] logout request failed, token discarded locally:', e.message);
        }
      }
      global.api.setTokens(null);
      window.location.hash = '#login';
      this.showLogin();
      console.log('[auth] logged out');
    },

    /** 是否持有未过期的会话凭据（真实有效性由 restoreSession 向后端确认） */
    isLoggedIn() {
      if (!global.api) {
        console.error('[auth] api.js 未加载，global.api 不存在');
        return false;
      }
      const tokens = global.api.getTokens();
      return !!(tokens && tokens.access && tokens.refresh);
    },

    /** 当前用户名（来自后端登录响应，不来自本地账号表） */
    getCurrentUser() {
      const tokens = global.api.getTokens();
      return tokens && tokens.username ? tokens.username : null;
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
        form.querySelector('button[type="submit"]').disabled = true;

        const result = await this.login(usernameInput.value, passwordInput.value);
        form.querySelector('button[type="submit"]').disabled = false;

        if (!result.ok) {
          msg.textContent = result.reason;
          msg.classList.add('error');
          if (result.retryAfter) {
            lockInfo.style.display = 'block';
            this.startCountdown(Number(result.retryAfter));
          }
        } else {
          msg.textContent = '登录成功！';
          msg.classList.add('success');
          setTimeout(() => this.showDashboard(), 300);
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

        form.querySelector('button[type="submit"]').disabled = true;
        const result = await this.register(username, password);
        form.querySelector('button[type="submit"]').disabled = false;

        if (!result.ok) {
          msg.textContent = result.reason;
          msg.classList.add('error');
        } else {
          msg.textContent = '注册成功！请去登录';
          msg.classList.add('success');
          setTimeout(() => {
            document.getElementById('login-username').value = username;
            switchTab('login-tab');
          }, 1500);
        }
      });

      switchLink?.addEventListener('click', () => switchTab('register-tab'));
      backLink?.addEventListener('click', () => switchTab('login-tab'));
    },

    bindLogout() {
      const btn = document.getElementById('logout-btn');
      if (btn) btn.addEventListener('click', () => this.logout());
    },

    /** 服务端锁定倒计时（仅展示，锁定事实以后端为准） */
    startCountdown(seconds) {
      const lockInfo = document.getElementById('login-lock-info');
      if (!lockInfo || !seconds) return;

      let remaining = seconds;
      const render = () => {
        if (remaining <= 0) {
          lockInfo.style.display = 'none';
          return;
        }
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        lockInfo.textContent = `账号已被服务端锁定，剩余 ${minutes} 分 ${secs} 秒`;
      };
      render();
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0 || lockInfo.style.display === 'none') {
          clearInterval(timer);
          lockInfo.style.display = 'none';
          return;
        }
        render();
      }, 1000);
    },

    /** 把后端错误翻译成可读文案 */
    describeError(err) {
      if (!err) return '未知错误';
      if (err.status === 429) return '操作过于频繁，请稍后再试';
      if (err.status === 423) return '账号已锁定，请稍后重试';
      if (err.status === 0) return err.message;
      const data = err.data || {};
      if (data.errors && typeof data.errors === 'object') {
        const first = Object.values(data.errors)[0];
        if (Array.isArray(first) && first.length) return String(first[0]);
        if (typeof first === 'string') return first;
      }
      return err.message || '请求失败';
    },

    /** 清理旧版本遗留在 localStorage 的账号表与锁定状态 */
    purgeLegacyLocalAuth() {
      try {
        localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
        Object.keys(localStorage)
          .filter((key) => key.startsWith(LEGACY_LOCK_PREFIX))
          .forEach((key) => localStorage.removeItem(key));
      } catch (e) {
        console.warn('[auth] legacy local auth cleanup failed:', e);
      }
    },
  };

  // ============ tab 切换 ============

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

  global.auth = auth;
  global.switchAuthTab = switchTab;
})(window);
