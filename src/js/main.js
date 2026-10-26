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
    const dropdownToggle = document.getElementById('export-dropdown');
    const exportMenu = document.getElementById('export-menu');
    const importFile = document.getElementById('import-file');
    const clearBtn = document.getElementById('clear-btn');

    // === 导出下拉菜单 ===
    if (dropdownToggle && exportMenu) {
      // 点击 toggle 开关下拉
      dropdownToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('show');
      });
      // 点击菜单项触发对应导出
      exportMenu.querySelectorAll('.dropdown-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const fmt = item.dataset.format;
          exportMenu.classList.remove('show');
          doExport(fmt);
        });
      });
      // 点击页面其他地方关闭下拉
      document.addEventListener('click', () => {
        exportMenu.classList.remove('show');
      });
    }

    // === 导入：按扩展名分派解析 ===
    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!confirm('导入将覆盖当前所有数据，确定继续？')) {
          e.target.value = '';
          return;
        }

        try {
          const ext = file.name.split('.').pop().toLowerCase();
          const count = await doImport(file, ext);
          alert(`导入成功！共恢复 ${count} 条记录。`);
          global.renderer.refreshAll();
          console.log('[main] Imported:', count, 'records (', ext, ')');
        } catch (err) {
          alert('导入失败：' + err.message);
        } finally {
          e.target.value = '';
        }
      });
    }

    // === 清空 ===
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

  // ============ 多格式导出 ============

  function doExport(format) {
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
        if (!global.XLSX) {
          alert('Excel 导出需要 SheetJS 库，但当前未加载。请检查网络后刷新页面，或改用 JSON/CSV 格式。');
          return;
        }
        const arrayBuffer = global.dataStore.exportExcel();
        triggerDownload(
          new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          `expense-backup-${dateStr}.xlsx`
        );
      } else {
        alert('未知导出格式：' + format);
        return;
      }
      console.log('[main] Exported format:', format);
    } catch (e) {
      alert('导出失败：' + e.message);
    }
  }

  // ============ 多格式导入 ============

  async function doImport(file, ext) {
    const exts = ['json', 'csv', 'xlsx', 'xls'];
    if (!exts.includes(ext)) {
      throw new Error(`不支持的文件格式 ".${ext}"，请选择 .json / .csv / .xlsx / .xls`);
    }

    if (ext === 'json') {
      const text = await file.text();
      return global.dataStore.importJSON(text);
    }

    if (ext === 'csv') {
      const text = await file.text();
      return global.dataStore.importCSV(text);
    }

    if (ext === 'xlsx' || ext === 'xls') {
      if (!global.XLSX) {
        throw new Error('Excel 导入需要 SheetJS 库，但当前未加载。请检查网络后刷新页面。');
      }
      const arrayBuffer = await file.arrayBuffer();
      return global.dataStore.importExcel(arrayBuffer);
    }
  }

  // ============ 下载辅助 ============

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 延迟释放 URL（部分浏览器需要）
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
})(window);
