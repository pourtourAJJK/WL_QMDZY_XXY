/**
 * form.js — 录入表单 UI + 校验 + 提交
 * Epic 2 实现真实逻辑
 */
(function (global) {
  'use strict';

  const form = {
    init() {
      this.amountInput = document.getElementById('amount');
      this.categorySelect = document.getElementById('category');
      this.dateInput = document.getElementById('date');
      this.noteInput = document.getElementById('note');
      this.formEl = document.getElementById('expense-form');
      this.submitBtn = document.getElementById('submit-btn');
      this.addCategoryBtn = document.getElementById('add-category-btn');

      this.lastCategory = null; // 记住上次使用的类别

      // 初始化类别下拉框
      this.populateCategories();

      // 日期默认今天
      this.dateInput.value = todayISO();

      // 绑定提交
      this.formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit();
      });

      // 绑定自定义类别按钮
      this.addCategoryBtn.addEventListener('click', () => {
        this.handleAddCustomCategory();
      });

      // 实时校验金额
      this.amountInput.addEventListener('input', () => this.validate());
    },

    /** 用 Categories 填充下拉框 */
    populateCategories() {
      const list = window.Categories.all();
      this.categorySelect.innerHTML = list
        .map((c) => `<option value="${escapeAttr(c.name)}" style="color:${c.color}">${escapeHtml(c.name)}</option>`)
        .join('');

      // 如果有上次选择的类别，恢复它
      if (this.lastCategory && this.categorySelect.querySelector(`option[value="${escapeAttr(this.lastCategory)}"]`)) {
        this.categorySelect.value = this.lastCategory;
      }
    },

    /** 校验表单 */
    validate() {
      const amount = parseFloat(this.amountInput.value);
      const ok = amount > 0 && this.categorySelect.value && this.dateInput.value;
      this.submitBtn.disabled = !ok;
      return ok;
    },

    /** 处理提交 */
    handleSubmit() {
      if (!this.validate()) return;

      const expense = {
        amount: parseFloat(this.amountInput.value),
        category: this.categorySelect.value,
        date: this.dateInput.value,
        note: (this.noteInput.value || '').trim(),
      };

      try {
        window.dataStore.add(expense);
        this.lastCategory = expense.category;
        this.resetForm();

        // 统一刷新（由 renderer 协调；Epic 5 实现）
        if (window.renderer && typeof window.renderer.refreshAll === 'function') {
          window.renderer.refreshAll();
        } else {
          // Epic 2 暂时手动触发各模块的 refreshAll（占位兜底）
          console.log('[form] expense added:', expense);
          if (window.charts && typeof window.charts.refreshAll === 'function') window.charts.refreshAll();
          if (window.cards && typeof window.cards.refreshAll === 'function') window.cards.refreshAll();
          if (window.listView && typeof window.listView.refreshAll === 'function') window.listView.refreshAll();
        }
      } catch (err) {
        alert('保存失败：' + err.message);
      }
    },

    /** 重置表单（保留上次类别选择） */
    resetForm() {
      this.amountInput.value = '';
      this.noteInput.value = '';
      this.dateInput.value = todayISO();
      this.amountInput.focus();
      this.validate();
    },

    /** 添加自定义类别（弹窗输入） */
    handleAddCustomCategory() {
      const name = prompt('输入新类别名称：');
      if (!name) return;

      const result = window.Categories.addCustom(name);
      if (!result.ok) {
        alert('添加失败：' + result.reason);
        return;
      }

      // 重新填充下拉框并自动选中新类别
      this.populateCategories();
      this.categorySelect.value = result.category.name;
    },
  };

  // ========== 工具函数 ==========

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  global.form = form;
})(window);
