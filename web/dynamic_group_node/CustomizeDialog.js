import { ComfyApp } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { ComfyDialog, $el } from "../../../scripts/ui.js";
import { NodeHelper } from "./NodeHelper.js";

export class CustomizeDialog extends ComfyDialog {
  static instance = null;

  static getInstance() {
    if (!CustomizeDialog.instance) {
      CustomizeDialog.instance = new CustomizeDialog();
    }
    return CustomizeDialog.instance;
  }

  constructor() {
    super();
    this.node = null;
    this.originalProperties = {};
    this.saved = false;
    this.isLayoutCreated = false;
    
    this.element = $el("div.comfy-modal.custom-dialog", {
      parent: document.body,
      style: { display: "flex", flexDirection: "column" }
    }, [
      $el("div.comfy-modal-content", this.createTabs())
    ]);
  }

  createTabs() {
    // Определение вкладок
    const tabsInfo = [
      { name: "Inputs", id: "inputs", placeholder: "Inputs (one per line)\nvar1: STRING\nvar2: INT" },
      { name: "Outputs", id: "outputs", placeholder: "Outputs (one per line)\nout1: STRING\nout2: INT" },
      { name: "Widgets", id: "widgets" },
      { name: "PyCode", id: "pycode", placeholder: "Enter Python code here..." }
    ];

    // Создаём панель кнопок для вкладок
    const tabButtons = tabsInfo.map(tab => {
      // Создаём кнопку без data-атрибута
      const button = $el("button.tab-button", {}, tab.name);
    
      // Явно устанавливаем button.dataset.tab
      button.dataset.tab = tab.id;
    
      return button;
    });
    const tabsContainer = $el("div.tabs", tabButtons);

    // Создаём содержимое для каждой вкладки
    const tabContents = tabsInfo.map(tab => {
      let content;
      if (tab.id === "widgets") {
        content = $el("div", { id: "widget-editor" });
      } else {
        content = $el("textarea", {
          id: `${tab.id}-textarea`,
          placeholder: tab.placeholder || ""
        });
      }
      const container = $el("div.tab-content", {}, [content]);
      container.dataset.tab = tab.id;
      container.style.flex = "1 1 auto";
      return container;
    });

    return [tabsContainer, ...tabContents];
  }

  createButton(name, callback) {
    const button = document.createElement("button");
    button.innerText = name;
    button.addEventListener("click", callback);
    return button;
  }

  createLeftButton(name, callback) {
    const button = this.createButton(name, callback);
    button.style.cssFloat = "left";
    button.style.marginRight = "4px";
    return button;
  }

  createRightButton(name, callback) {
    const button = this.createButton(name, callback);
    button.style.cssFloat = "right";
    button.style.marginLeft = "4px";
    return button;
  }

  setLayout() {
    const bottomPanel = document.createElement("div");
    Object.assign(bottomPanel.style, {
      position: "absolute",
      bottom: "0px",
      left: "20px",
      right: "20px",
      height: "50px"
    });
    this.element.appendChild(bottomPanel);

    this.saveButton = this.createLeftButton("Save", () => this.save());
    const cancelButton = this.createRightButton("Cancel", () => this.close());
    bottomPanel.appendChild(this.saveButton);
    bottomPanel.appendChild(cancelButton);

    // Следим за изменением видимости диалога
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          if (this.lastDisplayStyle && this.lastDisplayStyle !== "none" && this.element.style.display === "none") {
            ComfyApp.onClipspaceEditorClosed();
          }
          this.lastDisplayStyle = this.element.style.display;
        }
      });
    });
    observer.observe(this.element, { attributes: true });

    this.injectStyles();
  }

  injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .custom-dialog {
        --bg-primary: #1a1a1a;
        --bg-secondary: #2d2d2d;
        --text-primary: #ffffff;
        --border-color: #404040;
        --primary-accent: #2c5282;
        --primary-hover: #2b6cb0;
        --shadow-dark: rgba(0, 0, 0, 0.3);
      }
      .custom-dialog .widget-table {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px var(--shadow-dark);
        background: var(--bg-secondary);
      }
      .custom-dialog .widget-table th {
        background: var(--bg-primary);
        padding: 12px;
        color: var(--text-primary);
        font-weight: 500;
      }
      .custom-dialog .widget-table td {
        padding: 12px;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
        color: var(--text-primary);
      }
      .custom-dialog .table-action-btn {
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        transition: all 0.2s;
        background: var(--border-color);
        color: var(--text-primary);
      }
      .custom-dialog .table-action-btn:hover {
        background: var(--bg-primary);
      }
      .custom-dialog .widget-form-inline {
        background: var(--bg-secondary);
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px var(--shadow-dark);
        margin: 15px 0;
        color: var(--text-primary);
      }
      .custom-dialog .form-field input,
      .custom-dialog .form-field select {
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        transition: border-color 0.3s;
        background: var(--bg-primary);
        color: var(--text-primary);
      }
      .custom-dialog .form-field input:focus {
        border-color: var(--primary-accent);
        outline: none;
        box-shadow: 0 0 0 3px rgba(44, 82, 130, 0.2);
      }
      .custom-dialog button {
        cursor: pointer;
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: var(--primary-accent);
        color: var(--text-primary);
        transition: all 0.2s;
      }
      .custom-dialog button:hover {
        background: var(--primary-hover);
      }
      .custom-dialog .tab-content { 
        display: none;
        background: var(--bg-primary);
      }
      .custom-dialog .tab-content.active { 
        display: block;
        animation: fadeIn 0.3s;
      }
      .custom-dialog .tab-button {
        padding: 10px 20px;
        border: none;
        background: var(--bg-secondary);
        color: var(--text-primary);
        cursor: pointer;
        transition: all 0.2s;
      }
      .custom-dialog .tab-button.active {
        background: var(--primary-accent);
        color: var(--text-primary);
      }
      @keyframes fadeIn { 
        from { opacity: 0; } 
        to { opacity: 1; } 
      }
      .custom-dialog textarea {
        min-height: calc(80vh - 200px);
        width: 100%;
        background: var(--bg-primary);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        padding: 10px;
        box-sizing: border-box;
      }
      .custom-dialog .comfy-modal-content {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .custom-dialog .tabs {
        flex-shrink: 0; 
        background: var(--bg-secondary);
        z-index: 2;
        position: relative;
      }
      .custom-dialog .tab-content {
        flex-grow: 1;
        overflow: auto;
        padding: 15px;
      }
      .custom-dialog .tabs::after {
        content: "";
        display: block;
        height: 1px;
        background: var(--border-color);
        margin-top: -1px;
      }
    `;
    document.head.appendChild(style);
  }

  show(nodeData, node) {
    this.node = node;
    this.nodeData = nodeData;
    // Клонируем начальные свойства для возможности восстановления
    this.originalProperties = {
      widgets: node.properties.widgets,
      inputs: node.properties.inputs,
      outputs: node.properties.outputs,
      pycode: node.properties.pycode
    };

    if (!this.isLayoutCreated) {
      this.setLayout();
      this.isLayoutCreated = true;
    }

    Object.assign(this.element.style, {
      display: "flex",
      flexDirection: "column",
      width: "80vw",
      height: "80vh",
      maxWidth: "100vw",
      maxHeight: "100vh",
      padding: "0",
      zIndex: 8888
    });

    this.setTextareasContent();
    this.addTabListeners();
    // Активируем первую вкладку по умолчанию
    const firstTab = this.element.querySelector(".tab-button");
    if (firstTab) firstTab.classList.add("active");
  }

  setTextareasContent() {
    const inputsTextarea = this.element.querySelector("#inputs-textarea");
    if (inputsTextarea) inputsTextarea.value = this.node.properties.inputs;

    const outputsTextarea = this.element.querySelector("#outputs-textarea");
    if (outputsTextarea) outputsTextarea.value = this.node.properties.outputs;

    const pycodeTextarea = this.element.querySelector("#pycode-textarea");
    if (pycodeTextarea) pycodeTextarea.value = this.node.properties.pycode;

    // Рендерим редактор виджетов
    this.renderWidgetManagerInline();
  }

  addTabListeners() {
    const tabButtons = this.element.querySelectorAll(".tab-button");
    const tabContents = this.element.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
      button.addEventListener("click", () => {
        // Снимаем активность со всех кнопок и контента
        tabButtons.forEach(btn => btn.classList.remove("active"));
        tabContents.forEach(content => {
          content.style.display = "none";
          content.classList.remove("active");
        });
        // Активируем выбранную вкладку
        button.classList.add("active");
        const tabId = button.dataset.tab;
        tabContents.forEach(content => {
          if (content.dataset.tab === tabId) {
            content.style.display = "block";
            content.classList.add("active");
          }
        });
      });
    });

    // Устанавливаем активной первую вкладку
    if (tabButtons.length) tabButtons[0].click();
  }

  renderWidgetManagerInline() {
    const container = this.element.querySelector("#widget-editor");
    if (!container) return;
    container.innerHTML = "";

    const widgetsContainer = document.createElement("div");
    widgetsContainer.className = "widget-manager-container";

    const addWidgetBtn = document.createElement("button");
    addWidgetBtn.textContent = "Add Widget";
    addWidgetBtn.className = "add-widget-btn";
    addWidgetBtn.onclick = () => this.showInlineWidgetForm();
    widgetsContainer.appendChild(addWidgetBtn);

    // Создаём таблицу виджетов
    const table = document.createElement("table");
    table.className = "widget-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Type", "Name", "Value", "Actions"].forEach(text => {
      const th = document.createElement("th");
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    let widgets = [];
    try {
      widgets = JSON.parse(this.node.properties.widgets);
    } catch {
      widgets = [];
    }

    widgets.forEach((widget, index) => {
      const row = document.createElement("tr");
      ["type", "name", "value"].forEach(key => {
        const td = document.createElement("td");
        td.textContent = widget[key];
        row.appendChild(td);
      });
      const tdActions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => this.showInlineWidgetForm(widget, index);
      tdActions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.style.marginLeft = "5px";
      deleteBtn.onclick = () => {
        widgets.splice(index, 1);
        this.node.properties.widgets = JSON.stringify(widgets, null, 2);
        this.renderWidgetManagerInline();
      };
      tdActions.appendChild(deleteBtn);
      row.appendChild(tdActions);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    widgetsContainer.appendChild(table);
    container.appendChild(widgetsContainer);
  }

  showInlineWidgetForm(widgetToEdit = null, editIndex = null) {
    const container = this.element.querySelector("#widget-editor");
    if (!container) return;

    // Удаление предыдущей формы
    const existingForm = container.querySelector(".widget-form-inline");
    if (existingForm) existingForm.remove();

    // Создание элементов формы через шаблонную строку
    const formHTML = `
      <div class="widget-form-inline" style="position: relative; z-index: 1; backdrop-filter: blur(2px);">
        <div class="form-fields">
          ${this.createFormFieldsHTML(widgetToEdit)}
        </div>
        <div class="form-buttons" style="margin-top: 10px;">
          <button class="save-btn">Save</button>
          <button class="cancel-btn">Cancel</button>
        </div>
      </div>
    `;
    
    container.insertAdjacentHTML("beforeend", formHTML);
    const form = container.querySelector(".widget-form-inline");

    // Получение ссылок на элементы формы
    const typeSelect = form.querySelector("[data-field='type']");
    const nameInput = form.querySelector("[data-field='name']");
    const valueInput = form.querySelector("[data-field='value']");
    const minInput = form.querySelector("[data-field='min']");
    const maxInput = form.querySelector("[data-field='max']");
    const stepInput = form.querySelector("[data-field='step']");
    const comboInput = form.querySelector("[data-field='combo-values']");
    const separatorInput = form.querySelector("[data-field='combo-separator']");

    // Инициализация значений
    this.initFormValues(widgetToEdit, {
      typeSelect,
      minInput,
      maxInput,
      stepInput
    });

    // Управление видимостью полей
    const updateVisibility = () => this.updateFieldVisibility(typeSelect.value, form);
    typeSelect.addEventListener("change", updateVisibility);
    updateVisibility();

    // Обработчики событий
    form.querySelector(".save-btn").addEventListener("click", () => 
      this.handleFormSave(form, editIndex, widgetToEdit)
    );
    
    form.querySelector(".cancel-btn").addEventListener("click", () => 
      form.remove()
    );
}

// Вспомогательные методы:

createFormFieldsHTML(widget) {
    return `
      <div class="form-field">
        <label>Type</label>
        <select data-field="type">
          ${['INT', 'FLOAT', 'STRING', 'MSTRING', 'BOOLEAN', 'COMBO']
            .map(opt => `<option value="${opt}" ${widget?.type === opt ? 'selected' : ''}>${opt}</option>`)
            .join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Name</label>
        <input data-field="name" type="text" value="${widget?.name || ''}" required>
      </div>
      <div class="form-field">
        <label>Value</label>
        <input data-field="value" type="text" value="${widget?.value || ''}">
      </div>
      <div class="form-field number-field">
        <label>Min</label>
        <input data-field="min" type="number" value="${widget?.min ?? 1}">
      </div>
      <div class="form-field number-field">
        <label>Max</label>
        <input data-field="max" type="number" value="${widget?.max ?? 10000}">
      </div>
      <div class="form-field number-field">
        <label>Step</label>
        <input data-field="step" type="number" value="${widget?.step ?? 1}">
      </div>
      <div class="form-field combo-field">
        <label>Combo Values</label>
        <input data-field="combo-values" type="text" 
               value="${widget?.values?.join(widget?.separator || ',') || ''}">
      </div>
      <div class="form-field combo-field">
        <label>Combo Separator</label>
        <input data-field="combo-separator" type="text" 
               value="${widget?.separator || ','}">
      </div>
    `;
}

updateFieldVisibility(selectedType, form) {
    const isNumberType = ['INT', 'FLOAT'].includes(selectedType);
    const isComboType = selectedType === 'COMBO';

    form.querySelectorAll('.number-field').forEach(el => 
        el.style.display = isNumberType ? 'block' : 'none'
    );

    form.querySelectorAll('.combo-field').forEach(el => 
        el.style.display = isComboType ? 'block' : 'none'
    );
}

initFormValues(widget, fields) {
    if (!widget) return;
    
    // Для числовых полей устанавливаем минимальные допустимые значения
    fields.minInput.min = 0;
    fields.maxInput.min = fields.minInput.value;
    fields.stepInput.min = 0.1;
}

async handleFormSave(form, editIndex, widgetToEdit) {
    const getValue = (field) => form.querySelector(`[data-field="${field}"]`).value;
    
    const newWidget = {
        type: getValue('type'),
        name: getValue('name').trim(),
        value: getValue('value'),
    };

    // Валидация
    if (!newWidget.name) {
        this.showError('Name is required', form.querySelector('[data-field="name"]'));
        return;
    }

    // Добавление дополнительных полей по типу
    switch(newWidget.type) {
        case 'INT':
        case 'FLOAT':
            newWidget.min = parseFloat(getValue('min'));
            newWidget.max = parseFloat(getValue('max'));
            newWidget.step = parseFloat(getValue('step'));
            break;
            
        case 'COMBO':
            const separator = getValue('combo-separator') || ',';
            newWidget.values = getValue('combo-values')
                .split(separator)
                .map(v => v.trim())
                .filter(Boolean);
            newWidget.separator = separator;
            break;
    }

    // Обновление списка виджетов
    try {
        const widgets = JSON.parse(this.node.properties.widgets || '[]');
        
        if (widgetToEdit && editIndex !== null) {
            widgets[editIndex] = newWidget;
        } else {
            widgets.push(newWidget);
        }
        
        this.node.properties.widgets = JSON.stringify(widgets, null, 2);
        this.renderWidgetManagerInline();
        form.remove();
    } catch (error) {
        this.showError('Error saving widgets: ' + error.message);
    }
}

showError(message, element = null) {
    // Улучшенный вывод ошибок с подсветкой поля
    if (element) {
        element.style.border = '1px solid red';
        element.focus();
    }
    console.error(message);
    // Здесь лучше использовать кастомный модальный диалог вместо alert
    alert(message);
}

  save() {
    // Обновляем данные из текстовых полей
    const inputsTextarea = this.element.querySelector("#inputs-textarea");
    if (inputsTextarea) this.node.properties.inputs = inputsTextarea.value.trim();
    const outputsTextarea = this.element.querySelector("#outputs-textarea");
    if (outputsTextarea) this.node.properties.outputs = outputsTextarea.value.trim();
    const pycodeTextarea = this.element.querySelector("#pycode-textarea");
    if (pycodeTextarea) this.node.properties.pycode = pycodeTextarea.value;

    NodeHelper.createWidgets(this.nodeData, this.node);
    this.saved = true;
    this.close();
  }

  close() {
    if (!this.saved) {
      // В случае отмены восстанавливаем исходные данные
      Object.assign(this.node.properties, this.originalProperties);
    }
    this.saved = false;
    super.close();
  }
}
