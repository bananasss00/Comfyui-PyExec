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
    const existingForm = container.querySelector(".widget-form-inline");
    if (existingForm) existingForm.remove();

    const form = document.createElement("div");
    form.className = "widget-form-inline";
    form.style.cssText = "position: relative; z-index: 1; backdrop-filter: blur(2px);";
    container.appendChild(form);

    // Фабрика создания поля формы
    const createField = (labelText, type, value = "") => {
      const fieldContainer = document.createElement("div");
      fieldContainer.className = "form-field";
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = document.createElement(type === "select" ? "select" : "input");
      if (type !== "select") input.type = type;
      input.value = value;
      fieldContainer.appendChild(label);
      fieldContainer.appendChild(input);
      return { container: fieldContainer, input };
    };

    // Создание полей формы
    const typeField = createField("Type", "select", widgetToEdit ? widgetToEdit.type : "");
    ["INT", "FLOAT", "STRING", "MSTRING", "BOOLEAN", "COMBO"].forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (opt === typeField.input.value) option.selected = true;
      typeField.input.appendChild(option);
    });
    const nameField = createField("Name", "text", widgetToEdit ? widgetToEdit.name : "");
    const valueField = createField("Value", "text", widgetToEdit ? widgetToEdit.value : "");
    const minField = createField("Min", "number", widgetToEdit ? widgetToEdit.min : "1");
    const maxField = createField("Max", "number", widgetToEdit ? widgetToEdit.max : "10000");
    const stepField = createField("Step", "number", widgetToEdit ? widgetToEdit.step : "1");
    const comboField = createField("Combo Values (comma separated)", "text", widgetToEdit && widgetToEdit.values ? widgetToEdit.values.join(",") : "");

    const formFields = document.createElement("div");
    [typeField, nameField, valueField, minField, maxField, stepField, comboField].forEach(field => {
      formFields.appendChild(field.container);
    });
    form.appendChild(formFields);

    // Управление видимостью полей в зависимости от выбранного типа
    const updateFieldVisibility = selectedType => {
      const showNumFields = selectedType === "INT" || selectedType === "FLOAT";
      [minField.container, maxField.container, stepField.container].forEach(el => {
        el.style.display = showNumFields ? "" : "none";
      });
      comboField.container.style.display = selectedType === "COMBO" ? "" : "none";
    };
    updateFieldVisibility(typeField.input.value);
    typeField.input.addEventListener("change", () => updateFieldVisibility(typeField.input.value));

    // Кнопки Save и Cancel
    const btnContainer = document.createElement("div");
    btnContainer.style.marginTop = "10px";
    const saveBtn = this.createButton("Save", () => {
      const newWidget = {
        type: typeField.input.value,
        name: nameField.input.value.trim(),
        value: valueField.input.value,
        min: minField.input.value,
        max: maxField.input.value,
        step: stepField.input.value,
        values: comboField.input.value
          ? comboField.input.value.split(",").map(v => v.trim())
          : []
      };
      if (!newWidget.name) {
        alert("Name is required");
        return;
      }
      let widgets = [];
      try {
        widgets = JSON.parse(this.node.properties.widgets);
      } catch {
        widgets = [];
      }
      if (widgetToEdit && editIndex !== null) {
        widgets[editIndex] = newWidget;
      } else {
        widgets.push(newWidget);
      }
      this.node.properties.widgets = JSON.stringify(widgets, null, 2);
      this.renderWidgetManagerInline();
      form.remove();
    });
    const cancelBtn = this.createButton("Cancel", () => form.remove());
    cancelBtn.style.marginLeft = "5px";
    btnContainer.append(saveBtn, cancelBtn);
    form.appendChild(btnContainer);
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
