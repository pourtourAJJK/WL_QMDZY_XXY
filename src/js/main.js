/**
 * main.js — 应用入口，DOM ready 后串联全部模块
 * Epic 5: Story 5.1 (数据管理按钮), Story 5.2 (入口整合)
 */
(function (global) {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[main] DOM ready — initializing app...');

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

    // === 3. 初始化列表视图（绑定筛选下拉框 + 填充类别列表） ===
    if (global.listView && typeof global.listView.init === 'function') {
      global.listView.init();
      console.log('[main] listView initialized');
    }

    // === 4. 绑定数据管理按钮 ===
    bindDataManagement();

    // === 5. 首次全量刷新 ===
    global.renderer.refreshAll();

    console.log('[main] App ready ✅');
  });

  // ========== 数据管理按钮事件 ==========

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
          e.target.value = ''; // 重置，允许选同一个文件再次导入
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
