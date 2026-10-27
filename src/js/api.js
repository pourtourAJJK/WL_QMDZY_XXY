/**
 * api.js — 后端 API 客户端（JWT 令牌 + 自动刷新）
 *
 * 安全约束：
 *   1. 令牌只存 sessionStorage（关闭标签页即失效），不再有任何本地账号/密码数据；
 *   2. 请求统一附加 Authorization: Bearer <access>；
 *   3. access 过期（401）时用 refresh 换新令牌并重试一次，失败则视为登出。
 */
(function (global) {
  'use strict';

  const API_BASE = (global.API_BASE || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const TOKEN_KEY = 'auth_tokens';

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = 'ApiError';
      this.status = status || 0;
      this.data = data || {};
    }
  }

  const api = {
    base: API_BASE,
    ApiError,

    getTokens() {
      try {
        return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },

    setTokens(tokens) {
      if (tokens) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
      else sessionStorage.removeItem(TOKEN_KEY);
    },

    getAccessToken() {
      const tokens = this.getTokens();
      return tokens && tokens.access ? tokens.access : null;
    },

    /** 用 refresh 换取新的 access（轮换模式下 refresh 也会更新） */
    async refreshAccessToken() {
      const tokens = this.getTokens();
      if (!tokens || !tokens.refresh) throw new ApiError('登录已过期，请重新登录', 401, {});

      let response;
      try {
        response = await fetch(this.base + '/api/auth/refresh/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: tokens.refresh }),
        });
      } catch (e) {
        throw new ApiError('无法连接后端服务，请确认后端已启动', 0, {});
      }
      if (!response.ok) {
        this.setTokens(null);
        throw new ApiError('登录已过期，请重新登录', response.status, {});
      }
      const data = await response.json();
      this.setTokens({ ...tokens, access: data.access, refresh: data.refresh || tokens.refresh });
      return data.access;
    },

    /**
     * 发起请求
     * @param {string} path 形如 /api/expenses/
     * @param {{method?:string, body?:any, auth?:boolean, retry?:boolean}} options
     */
    async request(path, options) {
      const opts = Object.assign({ method: 'GET', body: null, auth: true, retry: true }, options || {});
      const headers = {};
      let payload = null;

      if (opts.body instanceof FormData) {
        payload = opts.body;                      // 浏览器自动带 multipart boundary
      } else if (opts.body !== null && opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(opts.body);
      }

      if (opts.auth) {
        const access = this.getAccessToken();
        if (!access) throw new ApiError('未登录或登录已过期', 401, {});
        headers['Authorization'] = 'Bearer ' + access;
      }

      let response;
      try {
        response = await fetch(this.base + path, { method: opts.method, headers, body: payload });
      } catch (e) {
        throw new ApiError('无法连接后端服务，请确认已启动 http://127.0.0.1:8000', 0, {});
      }

      // access 过期：刷新后重试一次
      if (response.status === 401 && opts.auth && opts.retry) {
        try {
          await this.refreshAccessToken();
          return await this.request(path, Object.assign({}, opts, { retry: false }));
        } catch (e) {
          throw new ApiError('登录已过期，请重新登录', 401, {});
        }
      }

      let data = null;
      if (response.status !== 204 && response.status !== 205) {
        try {
          data = await response.json();
        } catch (e) {
          data = null;
        }
      }

      if (!response.ok) {
        const message = (data && data.detail) || ('请求失败（HTTP ' + response.status + '）');
        throw new ApiError(message, response.status, data || {});
      }
      return data;
    },
  };

  global.api = api;
})(window);
