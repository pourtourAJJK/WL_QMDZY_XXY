/**
 * main.js — 应用入口
 * Feature: feature/auth-login（新增 auth 路由守卫）
 * 登录流程：auth.init() → 未登录显示登录页 → 登录成功触发 onAuthReady → 初始化业务模块
 */
(function (global) {
  'use strict';

  // ============ 路由守卫回调（auth.js 登录成功后调用） ============
  global.onAuthReady = () => {
    console.log('[main] Auth ready — initializing business modules...');

    // 更新 header 显示当前用户名
    const userEl = document.getElementById('current-user');
    if (userEl) {
      const name = global.auth.getCurrentUser() || '游客';
      userEl.textContent = '👤 ' + name;
    }

    initBusinessModules();
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[main] DOM ready — init auth first...');

    // === 0. 先初始化认证模块（决定显示登录页还是仪表盘） ===
    if (global.auth && typeof global.auth.init === 'function') {
      global.auth.init();
      // auth.init() 内部会根据登录态自动调用 showLogin() 或 showDashboard()
      // showDashboard() 会触发 global.onAuthReady()
    } else {
      console.error('[main] auth module not loaded');
    }

    // 如果已登录，主动初始化（auth.showDashboard 会调用 onAuthReady，但为了保险）
    if (global.auth && global.auth.isLoggedIn()) {
      global.onAuthReady();
    }
  });

  // ============ 业务模块初始化（登录后才执行） ============

  function initBusinessModules() {
    // === 1. 初始化 ECharts 实例 ===
    if (global.charts && typeof global.charts.init === 'function') {
      try {
        global.charts.init();
        console.log('[main] ECharts instances created');
      } catch (e) {
        console.error('[main] charts.init failed:', e);
      }
    }

    // === 2. 初始化录入表单 ===
    if (global.form && typeof global.form.init === 'function') {
      global.form.init();
      console.log('[main] form initialized');
    }

    // === 3. 初始化列表视图 ===
    if (global.listView && typeof global.listView.init === 'function') {
      global.listView.init();
      console.log('[main] listView initialized');
    }

    // === 4. 绑定数据管理按钮 ===
    bindDataManagement();

    // === 5. 首次全量刷新 ===
    global.renderer.refreshAll();

    console.log('[main] App ready ✅');
  }

  // ============ 数据管理按钮事件 ============

  function bindDataManagement() {
    const exportBtn = document.getElementById('export-btn');
    const importFile = document.getElementById('import-file');
    const clearBtn = document.getElementById('clear-btn');

    // 导出
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          const json = global.dataStore.exportJSON();
          const blob = new Blob([json], { type: 'application/json' });
          const now = new Date();
          const fname = `expense-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          console.log('[main] Exported:', fname);
        } catch (e) {
          alert('导出失败：' + e.message);
        }
      });
    }

    // 导入
    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('导入将覆盖当前所有数据，确定继续？')) {
          e.target.value = '';
          return;
        }

        try {
          const text = await file.text();
          const count = global.dataStore.importJSON(text);
          alert(`导入成功！共恢复 ${count} 条记录。`);
          global.renderer.refreshAll();
          console.log('[main] Imported:', count, 'records');
        } catch (err) {
          alert('导入失败：' + err.message);
        } finally {
          e.target.value = '';
        }
      });
    }

    // 清空
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (!confirm('⚠️ 确定要清空所有开销数据吗？此操作不可撤销！')) return;
        if (!confirm('⚠️ 再次确认：真的要清空吗？')) return;

        global.dataStore.clear();
        global.renderer.refreshAll();
        console.log('[main] All data cleared');
      });
    }
  }
})(window);
