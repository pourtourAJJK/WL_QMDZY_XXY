/**
 * list-view.js — 开销列表渲染 + 类别筛选 + 删除
 * Epic 4: Story 4.1 (列表 + 删除), 4.2 (类别筛选)
 */
(function (global) {
  'use strict';

  const listView = {
    filterSelect: null,
    listContainer: null,

    /** 初始化（main.js 入口调用） */
    init() {
      this.filterSelect = document.getElementById('filter-category');
      this.listContainer = document.getElementById('expense-list');

      // 填充筛选下拉框
      this.populateCategoryFilter();

      // 绑定筛选事件
      this.filterSelect.addEventListener('change', () => {
        const filter = this.filterSelect.value; // 空字符串表示全部
        if (global.renderer && typeof global.renderer.refreshAll === 'function') {
          global.renderer.refreshAll(filter);
        } else {
          // 兜底：手动刷新各模块
          global.charts.refreshAll(filter);
          global.cards.refreshAll();
          this.refreshAll(filter);
        }
      });
    },

    /** 填充筛选下拉框（全部 + 所有类别） */
    populateCategoryFilter() {
      if (!this.filterSelect) return;
      const current = this.filterSelect.value; // 保留当前选择
      const list = global.Categories.all();
      this.filterSelect.innerHTML =
        '<option value="">全部</option>' +
        list
          .map(
            (c) =>
              `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`
          )
          .join('');
      if (current && this.filterSelect.querySelector(`option[value="${escapeAttr(current)}"]`)) {
        this.filterSelect.value = current;
      }
    },

    /** 刷新列表 */
    refreshAll(filterCategory) {
      if (!this.listContainer) return;

      let list = global.dataStore.getAll();

      // 筛选
      if (filterCategory) {
        list = list.filter((e) => e.category === filterCategory);
      }

      // 日期倒序（新 → 旧）
      list.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        // 同日按 created_at 倒序
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      if (list.length === 0) {
        this.listContainer.innerHTML =
          '<div class="empty-state">暂无记录</div>';
        return;
      }

      this.listContainer.innerHTML = list.map(this.renderItem).join('');

      // 绑定删除事件（事件委托）
      this.listContainer.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          this.handleDelete(id);
        });
      });
    },

    /** 渲染单条记录 */
    renderItem(expense) {
      const color = global.Categories.getColorByName(expense.category);
      return `
        <div class="expense-item">
          <div class="expense-info">
            <span class="expense-date">${escapeHtml(expense.date)}</span>
            <span class="category-tag" style="background-color:${color}">${escapeHtml(expense.category)}</span>
            <span class="expense-note">${expense.note ? escapeHtml(expense.note) : ''}</span>
          </div>
          <span class="expense-amount">¥${Number(expense.amount).toFixed(2)}</span>
          <button class="delete-btn" data-id="${escapeAttr(expense.id)}">删除</button>
        </div>
      `;
    },

    /** 处理删除（后端删除成功后刷新视图） */
    async handleDelete(id) {
      if (!confirm('确定删除这笔开销吗？此操作不可撤销。')) return;

      try {
        await global.dataStore.delete(id);
      } catch (err) {
        alert('删除失败：' + err.message);
        if (err.status === 401 && global.auth) global.auth.logout();
        return;
      }

      // 统一刷新
      const filter = this.filterSelect ? this.filterSelect.value : '';
      if (global.renderer && typeof global.renderer.refreshAll === 'function') {
        global.renderer.refreshAll(filter);
      }
    },
  };

  // ========== 工具 ==========

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.listView = listView;
})(window);
