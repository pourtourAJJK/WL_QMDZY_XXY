/**
 * main.js — 应用入口（后端鉴权版）
 * 流程：auth.init() → 校验 JWT 会话 → 登录后 onAuthReady → 从后端拉取数据 → 初始化业务模块
 */
(function (global) {
  'use strict';

  let businessModulesInited = false;

  // 认证通过后由 auth.showDashboard() 触发
  global.onAuthReady = async () => {
    if (businessModulesInited) {
      console.warn('[main] business modules already initialized, skipping');
      return;
    }
    businessModulesInited = true;

    console.log('[main] Auth ready — initializing business modules...');

    const userEl = document.getElementById('current-user');
    if (userEl) userEl.textContent = global.auth.getCurrentUser() || '游客';

    await initBusinessModules();
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[main] DOM ready — init auth first...');
    if (global.auth && typeof global.auth.init === 'function') {
      global.auth.init();
    } else {
      console.error('[main] auth module not loaded');
    }
  });

  // ============ 业务模块初始化 ============

  async function initBusinessModules() {
    try {
      // 1. 先取回当前用户数据（唯一事实源在后端）
      try {
        await global.dataStore.load();
        console.log('[main] expenses loaded:', global.dataStore.getAll().length);
      } catch (err) {
        console.error('[main] dataStore.load failed:', err);
        if (err.status === 401) {
          alert('登录已过期，请重新登录');
          global.auth.logout();
          return;
        }
      }

      // 2. ECharts 实例（await 消除时序竞态）
      if (global.charts && typeof global.charts.init === 'function') {
        try {
          await global.charts.init();
          console.log('[main] ECharts instances created');
        } catch (e) {
          console.error('[main] charts.init failed:', e);
        }
      }

      // 3. 录入表单
      if (global.form && typeof global.form.init === 'function') {
        global.form.init();
      }

      // 4. 列表视图
      if (global.listView && typeof global.listView.init === 'function') {
        global.listView.init();
      }

      // 5. 数据管理按钮
      bindDataManagement();

      // 6. 首次全量刷新
      global.renderer.refreshAll();

      console.log('[main] App ready');
    } catch (err) {
      console.error('[main] initBusinessModules failed:', err);
    }
  }

  // ============ 数据管理 ============

  function bindDataManagement() {
    const dropdownToggle = document.getElementById('export-dropdown');
    const exportMenu = document.getElementById('export-menu');
    const importFile = document.getElementById('import-file');
    const clearBtn = document.getElementById('clear-btn');

    // 导出下拉菜单
    if (dropdownToggle && exportMenu) {
      dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('show');
      });
      exportMenu.querySelectorAll('.dropdown-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          exportMenu.classList.remove('show');
          doExport(item.dataset.format);
        });
      });
      document.addEventListener('click', () => exportMenu.classList.remove('show'));
    }

    // 导入：文件直接上传后端解析与校验（后端按用户隔离并覆盖写入）
    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('导入将覆盖当前所有数据，确定继续？')) {
          e.target.value = '';
          return;
        }

        try {
          const count = await global.dataStore.importFile(file);
          alert(`导入成功！后端已校验并恢复 ${count} 条记录。`);
          global.renderer.refreshAll();
        } catch (err) {
          alert('导入失败：' + err.message);
          if (err.status === 401) global.auth.logout();
        } finally {
          e.target.value = '';
        }
      });
    }

    // 清空
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        if (!confirm('确定要清空所有开销数据吗？此操作不可撤销！')) return;
        if (!confirm('再次确认：真的要清空吗？')) return;

        try {
          await global.dataStore.clear();
          global.renderer.refreshAll();
          console.log('[main] All data cleared (server side)');
        } catch (err) {
          alert('清空失败：' + err.message);
          if (err.status === 401) global.auth.logout();
        }
      });
    }
  }

  // ============ 导出 ============
  // JSON / CSV 由后端快照在本地拼装；Excel 由后端 openpyxl 生成（不依赖前端 SheetJS）

  async function doExport(format) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      if (format === 'json') {
        const json = global.dataStore.exportJSON();
        triggerDownload(
          new Blob([json], { type: 'application/json;charset=utf-8' }),
          `expense-backup-${dateStr}.json`
        );
      } else if (format === 'csv') {
        const csv = global.dataStore.exportCSV();
        triggerDownload(
          new Blob([csv], { type: 'text/csv;charset=utf-8' }),
          `expense-backup-${dateStr}.csv`
        );
      } else if (format === 'excel') {
        // 服务端生成 xlsx：带表头样式、列宽、冻结首行与金额格式
        const result = await global.api.download('/api/expenses/export/');
        triggerDownload(result.blob, result.filename || `expense-backup-${dateStr}.xlsx`);
      } else {
        alert('未知导出格式：' + format);
      }
    } catch (e) {
      alert('导出失败：' + e.message);
      if (e.status === 401 && global.auth) global.auth.logout();
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})(window);
