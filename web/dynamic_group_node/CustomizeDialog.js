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
    this.element = $el("div.comfy-modal.custom-dialog", {
      parent: document.body,
      style: { 'display': 'flex', 'flex-direction': 'column' }
    }, [
      $el("div.comfy-modal-content", [
        ...this.createTabs(),
      ])
    ]);
    this.node = null;
    this.originalProperties = {}; // Новое свойство
    this.saved = false; // Флаг сохранения
  }

  createTabs() {
    const btnIO = $el("button.tab-button", {}, "Inputs");
    btnIO.dataset.tab = "inputs";

    const btnO = $el("button.tab-button", {}, "Outputs");
    btnO.dataset.tab = "outputs";

    const btnW = $el("button.tab-button", {}, "Widgets");
    btnW.dataset.tab = "widgets";

    const btnPy = $el("button.tab-button", {}, "PyCode");
    btnPy.dataset.tab = "pycode";

    const tabs = [
      $el("div.tabs", [
        btnIO,
        btnO,
        btnW,
        btnPy
      ])
    ];


    const tabIO = $el("div.tab-content", {}, [
      $el("textarea", {
        id: "inputs-textarea",
        // rows: "10",
        // cols: "50",
        placeholder: "Inputs (one per line)\nvar1: STRING\nvar2: INT"
      })
    ]);
    tabIO.dataset.tab = "inputs";

    const tabO = $el("div.tab-content", {}, [
      $el("textarea", {
        id: "outputs-textarea",
        // rows: "10",
        // cols: "50",
        placeholder: "Outputs (one per line)\nout1: STRING\nout2: INT"
      })
    ]);
    tabO.dataset.tab = "outputs";

    const tabW = $el("div.tab-content", {}, [
      // Inline-редактирование виджетов
      $el("div", { id: "widget-editor" })
    ]);
    tabW.dataset.tab = "widgets";

    const tabPy = $el("div.tab-content", { "data-tab": "pycode" }, [
      $el("textarea", {
        id: "pycode-textarea",
        placeholder: "Enter Python code here...",
        // style: {width: '100%', height: '100%', resize: 'none'}, // Убраны rows/cols, добавлены стили
      })
    ]);
    tabPy.dataset.tab = "pycode";

    const tabContents = [
      tabIO,
      tabO,
      tabW,
      tabPy
    ].map(tab => {
      tab.style.flex = "1 1 auto"; // Добавляем для гибкого растягивания
      return tab;
    });

    return [...tabs, ...tabContents];
  }

  // createButtons() {
  //   return [
  //     this.createLeftButton("Save", () => this.save()),
  //     this.createRightButton("Cancel", () => this.close())
  //   ];
  // }
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
    const self = this;
    const bottomPanel = document.createElement("div");
    bottomPanel.style.position = "absolute";
    bottomPanel.style.bottom = "0px";
    bottomPanel.style.left = "20px";
    bottomPanel.style.right = "20px";
    bottomPanel.style.height = "50px";
    this.element.appendChild(bottomPanel);

    self.saveButton = this.createLeftButton("Save", () => self.save());
    const cancelButton = this.createRightButton("Cancel", () => self.close());

    bottomPanel.appendChild(self.saveButton);
    bottomPanel.appendChild(cancelButton);

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          if (self.last_display_style && self.last_display_style !== "none" && self.element.style.display === "none") {
            ComfyApp.onClipspaceEditorClosed();
          }
          self.last_display_style = self.element.style.display;
        }
      });
    });
    observer.observe(this.element, { attributes: true });

    // Добавляем стили для inline-редактирования виджетов
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

      /* Таблицы */
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

      /* Кнопки действий */
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

      /* Формы */
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

      /* Общие кнопки */
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

      /* Вкладки */
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

      // #pycode-textarea {
      //   min-height: calc(80vh - 200px); // Настраиваем под размер окна
      //   background: var(--bg-primary);
      //   color: var(--text-primary);
      //   border: 1px solid var(--border-color);
      //   padding: 10px;
      // }
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

      /* Добавляем разделитель между вкладками и контентом */
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
    this.originalProperties = {
      widgets: node.properties.widgets,
      inputs: node.properties.inputs,
      outputs: node.properties.outputs,
      pycode: node.properties.pycode
    };

    if (!this.is_layout_created) {
      this.setLayout();
      this.is_layout_created = true;
    }

    this.element.style.display = "flex";
    this.element.style.flexDirection = "column";
    this.element.style.width = "80vw";
    this.element.style.height = "80vh";
    this.element.style.maxWidth = "100vw";
    this.element.style.maxHeight = "100vh";
    this.element.style.padding = "0";
    this.element.style.zIndex = 8888;

    this.setTextareasContent();
    this.addTabListeners();
    const firstTab = this.element.querySelector(".tab-button");
    if (firstTab) {
      firstTab.classList.add("active");
    }
  }

  setTextareasContent() {
    const inputsTextarea = this.element.querySelector("#inputs-textarea");
    inputsTextarea.value = this.node.properties.inputs;

    const outputsTextarea = this.element.querySelector("#outputs-textarea");
    outputsTextarea.value = this.node.properties.outputs;

    const pycodeTextarea = this.element.querySelector("#pycode-textarea");
    pycodeTextarea.value = this.node.properties.pycode;

    // Рендерим редактор виджетов на вкладке Widgets
    this.renderWidgetManagerInline();
  }

  addTabListeners() {
    const tabButtons = this.element.querySelectorAll(".tab-button");
    const tabContents = this.element.querySelectorAll(".tab-content");

    tabButtons.forEach(button => {
      button.addEventListener("click", () => {
        // Убираем активность у всех кнопок
        tabButtons.forEach(btn => btn.classList.remove("active"));

        // Активируем текущую кнопку
        button.classList.add("active");

        const tab = button.getAttribute("data-tab");
        tabContents.forEach(content => {
          const isActive = content.getAttribute("data-tab") === tab;
          console.log(content.getAttribute("data-tab"), tab, isActive);
          content.style.display = isActive ? "block" : "none";
          content.classList.toggle("active", isActive);
        });
      });
    });

    // Активируем первую вкладку по умолчанию
    if (tabButtons.length > 0) {
      tabButtons[0].click();
    }
  }

  renderWidgetManagerInline() {
    const container = this.element.querySelector("#widget-editor");
    container.innerHTML = ""; // Очистка контейнера

    const widgetsContainer = document.createElement("div");
    widgetsContainer.className = "widget-manager-container";

    // Кнопка добавления нового виджета
    const addWidgetBtn = document.createElement("button");
    addWidgetBtn.textContent = "Add Widget";
    addWidgetBtn.className = "add-widget-btn";
    addWidgetBtn.onclick = () => this.showInlineWidgetForm();
    widgetsContainer.appendChild(addWidgetBtn);

    // Таблица существующих виджетов
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
    } catch (e) {
      widgets = [];
    }

    widgets.forEach((widget, index) => {
      const row = document.createElement("tr");

      const tdType = document.createElement("td");
      tdType.textContent = widget.type;
      row.appendChild(tdType);

      const tdName = document.createElement("td");
      tdName.textContent = widget.name;
      row.appendChild(tdName);

      const tdValue = document.createElement("td");
      tdValue.textContent = widget.value;
      row.appendChild(tdValue);

      const tdActions = document.createElement("td");
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.onclick = () => this.showInlineWidgetForm(widget, index);
      tdActions.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
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
    const existingForm = container.querySelector(".widget-form-inline");
    if (existingForm) existingForm.remove();

    const isEdit = !!widgetToEdit;
    const form = document.createElement("div");
    form.className = "widget-form-inline";
    form.style.cssText = `
      position: relative;
      z-index: 1;
      backdrop-filter: blur(2px);
    `;
    container.appendChild(form);

    // Поля формы
    const typeField = this.createSelect("Type", ["INT", "FLOAT", "STRING", "MSTRING", "BOOLEAN", "COMBO"], widgetToEdit ? widgetToEdit.type : "");
    const nameField = this.createInput("Name", "text", widgetToEdit ? widgetToEdit.name : "");
    const valueField = this.createInput("Value", "text", widgetToEdit ? widgetToEdit.value : "");
    const minField = this.createInput("Min", "number", widgetToEdit ? widgetToEdit.min : "1");
    const maxField = this.createInput("Max", "number", widgetToEdit ? widgetToEdit.max : "10000");
    const stepField = this.createInput("Step", "number", widgetToEdit ? widgetToEdit.step : "1");
    const comboField = this.createInput("Combo Values (comma separated)", "text", widgetToEdit && widgetToEdit.values ? widgetToEdit.values.join(",") : "");

    const formFields = document.createElement("div");
    [typeField, nameField, valueField, minField, maxField, stepField, comboField].forEach(fieldObj => {
      const fieldContainer = document.createElement("div");
      fieldContainer.className = "form-field";
      const label = document.createElement("label");
      label.textContent = fieldObj.label;
      fieldContainer.appendChild(label);
      fieldContainer.appendChild(fieldObj.input);
      formFields.appendChild(fieldContainer);
    });
    form.appendChild(formFields);

    // Управление видимостью полей в зависимости от типа
    function updateFieldVisibility(selectedType) {
      if (selectedType === "INT" || selectedType === "FLOAT") {
        minField.input.parentElement.style.display = "";
        maxField.input.parentElement.style.display = "";
        stepField.input.parentElement.style.display = "";
      } else {
        minField.input.parentElement.style.display = "none";
        maxField.input.parentElement.style.display = "none";
        stepField.input.parentElement.style.display = "none";
      }
      if (selectedType === "COMBO") {
        comboField.input.parentElement.style.display = "";
      } else {
        comboField.input.parentElement.style.display = "none";
      }
    }
    updateFieldVisibility(typeField.input.value);
    typeField.input.addEventListener("change", () => {
      updateFieldVisibility(typeField.input.value);
    });

    // Кнопки Save и Cancel
    const btnContainer = document.createElement("div");
    btnContainer.style.marginTop = "10px";
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.onclick = () => {
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
      } catch (e) {
        widgets = [];
      }
      if (isEdit && editIndex !== null) {
        widgets[editIndex] = newWidget;
      } else {
        widgets.push(newWidget);
      }
      this.node.properties.widgets = JSON.stringify(widgets, null, 2);
      this.renderWidgetManagerInline();
      form.remove();
    };
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.marginLeft = "5px";
    cancelBtn.onclick = () => form.remove();
    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);
    form.appendChild(btnContainer);

    container.appendChild(form);
  }

  createSelect(labelText, options, selected) {
    const label = labelText;
    const select = document.createElement("select");
    select.className = "modern-select";
    options.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      if (opt === selected) option.selected = true;
      select.appendChild(option);
    });
    return { label, input: select };
  }

  createInput(labelText, type, value = "") {
    const label = labelText;
    const input = document.createElement("input");
    input.className = "modern-input";
    input.type = type;
    input.value = value;

    return { label, input };
  }

  save() {
    // Сохраняем Inputs
    const inputsText = this.element.querySelector("#inputs-textarea").value;
    this.node.properties.inputs = inputsText.trim();

    // Сохраняем Outputs
    const outputsText = this.element.querySelector("#outputs-textarea").value;
    this.node.properties.outputs = outputsText.trim();

    // PyCode оставляем без изменений
    const pycodeText = this.element.querySelector("#pycode-textarea").value;
    this.node.properties.pycode = pycodeText;

    NodeHelper.createWidgets(this.nodeData, this.node);
    this.saved = true;
    this.close();
  }

  close() {
    if (!this.saved) {
      // Восстанавливаем исходные данные
      this.node.properties.widgets = this.originalProperties.widgets;
      this.node.properties.inputs = this.originalProperties.inputs;
      this.node.properties.outputs = this.originalProperties.outputs;
      this.node.properties.pycode = this.originalProperties.pycode;
    }
    this.saved = false; // Сброс флага

    super.close();
  }
}
