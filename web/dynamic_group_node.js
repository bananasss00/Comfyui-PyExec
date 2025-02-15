import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { ComfyDialog, $el } from "../../scripts/ui.js";
import { ComfyApp } from "../../scripts/app.js";

// Constants and helpers
const NODE_TYPE = "DynamicGroupNode";

const DEFAULT_PROPERTIES = {
  pycode: `out1=var1
out2=var2
my_age=MyAge
weight=Weight
name=Name
active=Active
gender=Gender
result='some result'
`,
  inputs: 'var1: STRING\nvar2: INT',
  widgets: JSON.stringify([
    { type: 'INT', name: 'MyAge', value: '30', min: '0', max: '100', step: '1' },
    { type: 'FLOAT', name: 'Weight', value: '75.5', min: '50', max: '150', step: '0.5', precision: '3' },
    { type: 'STRING', name: 'Name', value: 'John' },
    { type: 'MSTRING', name: 'Name2', value: 'John' },
    { type: 'BOOLEAN', name: 'Active', value: 'true' },
    { type: 'COMBO', name: 'Gender', value: 'male', values: ['male', 'female'] }
  ], null, 4),
  outputs: 'out1: STRING\nout2: INT\nmy_age: INT\nweight: FLOAT\nname: STRING\nactive: BOOLEAN\ngender: STRING',
  widgets_values: {}
};

// Function to add a multiline widget
function addMultilineWidget(node, name, callback2, opts) {
  const inputEl = document.createElement("textarea");
  inputEl.className = "comfy-multiline-input";
  inputEl.value = opts.defaultVal;
  inputEl.placeholder = opts.placeholder || name;
  const widget = node.addDOMWidget(name, "customtext", inputEl, {
    getValue() {
      return inputEl.value;
    },
    setValue(v2) {
      inputEl.value = v2;
    }
  });
  widget.callback = callback2;
  widget.inputEl = inputEl;
  inputEl.addEventListener("input", () => {
    widget.callback?.(widget.value);
  });
  inputEl.addEventListener("pointerdown", (event) => {
    if (event.button === 1) {
      app.canvas.processMouseDown(event);
    }
  });
  inputEl.addEventListener("pointermove", (event) => {
    if ((event.buttons & 4) === 4) {
      app.canvas.processMouseMove(event);
    }
  });
  inputEl.addEventListener("pointerup", (event) => {
    if (event.button === 1) {
      app.canvas.processMouseUp(event);
    }
  });
  return { minWidth: 400, minHeight: 200, widget: widget };
}

// Widget factory for different types of widgets
const WIDGET_FACTORY = {
  INT: (node, widget, getValue, callback) =>
    node.addWidget('number', widget.name, getValue(widget), callback, {
      min: Number(widget.min),
      max: Number(widget.max),
      step: Number(widget.step) * 10,
      round: 1,
      precision: 0
    }),

  FLOAT: (node, widget, getValue, callback) =>
    node.addWidget('number', widget.name, getValue(widget), callback, {
      min: Number(widget.min),
      max: Number(widget.max),
      step: Number(widget.step) * 10,
      precision: Number(widget.precision) || 3
    }),

  STRING: (node, widget, getValue, callback) =>
    node.addWidget('string', widget.name, getValue(widget), callback),

  MSTRING: (node, widget, getValue, callback) =>
    addMultilineWidget(node, widget.name, callback, {defaultVal: getValue(widget)}),

  BOOLEAN: (node, widget, getValue, callback) =>
    node.addWidget('toggle', widget.name, getValue(widget), callback),

  COMBO: (node, widget, getValue, callback) =>
    node.addWidget('combo', widget.name, getValue(widget), callback, {
      values: widget.values
    })
};

class CustomizeDialog extends ComfyDialog {
  static instance = null;

  static getInstance() {
    if (!CustomizeDialog.instance) {
      CustomizeDialog.instance = new CustomizeDialog();
    }
    return CustomizeDialog.instance;
  }

  constructor() {
    super();
    this.element = $el("div.comfy-modal.custom-dialog", { parent: document.body,
      style: {'display': 'flex', 'flex-direction': 'column'}
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
    const btnIO = $el("button.tab-button", { }, "Inputs");
    btnIO.dataset.tab = "inputs";

    const btnO = $el("button.tab-button", { }, "Outputs");
    btnO.dataset.tab = "outputs";

    const btnW = $el("button.tab-button", { }, "Widgets");
    btnW.dataset.tab = "widgets";

    const btnPy = $el("button.tab-button", { }, "PyCode");
    btnPy.dataset.tab = "pycode";

    const tabs = [
      $el("div.tabs", [
        btnIO,
        btnO,
        btnW,
        btnPy
      ])
    ];


    const tabIO = $el("div.tab-content", { }, [
      $el("textarea", {
        id: "inputs-textarea",
        // rows: "10",
        // cols: "50",
        placeholder: "Inputs (one per line)\nvar1: STRING\nvar2: INT"
      })
    ]);
    tabIO.dataset.tab = "inputs";

    const tabO = $el("div.tab-content", { }, [
      $el("textarea", {
        id: "outputs-textarea",
        // rows: "10",
        // cols: "50",
        placeholder: "Outputs (one per line)\nout1: STRING\nout2: INT"
      })
    ]);
    tabO.dataset.tab = "outputs";

    const tabW = $el("div.tab-content", { }, [
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

  show(node) {
    this.node = node;
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
  
    NodeHelper.createWidgets(this.node);
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


// Helper class to manage node widgets
class NodeHelper {
  static createWidgets(node) {
    const currentLinks = node.inputs.map(input => input.link);
    console.log(currentLinks);

    // remove multiline widgets elements
    node.widgets?.forEach((widget, index) => {
      if (widget.type === 'customtext') {
        widget.element.remove();
        console.log(`customtext ${widget.name} removed`);
      }
    });

    // Clear previous elements
    node.inputs = [];
    node.widgets = [];
    node.outputs = [];

    // Create inputs
    NodeHelper.createInputs(node);

    // Restore link values
    node.inputs.forEach((input, index) => {
      if (currentLinks[index]) {
        input.link = currentLinks[index];
        console.log(`Link restored for input ${index}:`, input.link);
      }
    });

    // Create widgets
    NodeHelper.createNodeWidgets(node);

    // Create outputs
    NodeHelper.createOutputs(node);

    node.serialize();
  }

  static createInputs(node) {
    const inputs = node.properties.inputs.trim().split('\n');
    inputs.forEach(input => {
      let name, type;
      if (input.includes(':')) {
        [name, type] = input.split(':').map(str => str.trim());
      } else {
        name = input.trim();
        type = '*';
      }
      node.addInput(name, type.toUpperCase());
    });
  }

  static createOutputs(node) {
    const outputs = node.properties.outputs.trim().split('\n');
    outputs.forEach(output => {
      let name, type;
      if (output.includes(':')) {
        [name, type] = output.split(':').map(str => str.trim());
      } else {
        name = output.trim();
        type = '*';
      }
      node.addOutput(name, type.toUpperCase());
    });
  }

  static createNodeWidgets(node) {
    // node.addWidget('button', 'Customize', 'customize', () => {
    //   const dlg = CustomizeDialog.getInstance();
    //   dlg.show(node);
    // });

    try {
      const widgetsConfig = JSON.parse(node.properties.widgets);
      widgetsConfig.forEach(widget => {
        const type = widget.type.toUpperCase();
        const factory = WIDGET_FACTORY[type];

        if (!factory) {
          console.warn(`Unknown widget type: ${type}`);
          return;
        }

        const callback = value => NodeHelper.handleWidgetChange(node, widget.name, value);
        const getValue = w => NodeHelper.getWidgetValue(node, w);

        factory(node, widget, getValue, callback);
      });
    } catch (error) {
      console.error("Error parsing widgets config:", error);
    }
  }

  static handleWidgetChange(node, name, value) {
    node.properties.widgets_values = node.properties.widgets_values || {};
    node.properties.widgets_values[name] = value;
    node.serialize();
    console.log(`Widget ${name} changed to ${value}`);
  }

  static getWidgetValue(node, widget) {
    const defaultValue = this.parseValue(widget);
    return node.properties.widgets_values?.[widget.name] ?? defaultValue;
  }

  static parseValue(widget) {
    switch (widget.type.toUpperCase()) {
      case 'INT': return parseInt(widget.value, 10);
      case 'FLOAT': return parseFloat(widget.value);
      case 'BOOLEAN': return widget.value.toLowerCase() === 'true';
      default: return widget.value;
    }
  }

    }

// Class to render node types
class TypeRenderer {
  static drawPortTypes(node, ctx) {
    if (node.flags?.collapsed) return;

    ctx.save();
    TypeRenderer.drawOutputTypes(node, ctx);
    TypeRenderer.drawInputTypes(node, ctx);
    ctx.restore();
  }

  static drawOutputTypes(node, ctx) {
    node.outputs?.forEach((output, index) => {
      const type = output.type === "*" ? "any" : output.type.toLowerCase();
      const color = LGraphCanvas.link_type_colors[output.type.toUpperCase()] || "#AAA";

      TypeRenderer.drawTypeLabel(ctx, type, color, {
        x: node.size[0] - ctx.measureText(output.name).width - 25,
        y: index * 20 + 19,
        align: "right"
      });
    });
  }

  static drawInputTypes(node, ctx) {
    node.inputs?.forEach((input, index) => {
      const type = input.type === "*" ? "any" : input.type.toLowerCase();
      const color = LGraphCanvas.link_type_colors[input.type.toUpperCase()] || "#AAA";

      TypeRenderer.drawTypeLabel(ctx, type, color, {
        x: 25 + ctx.measureText(input.name).width,
        y: index * 20 + 19,
        align: "left"
      });
    });
  }

  static drawTypeLabel(ctx, text, color, {x, y, align}) {
    ctx.fillStyle = color;
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = align;
    ctx.fillText(`[${text}]`, x, y);
  }
}

// Register the extension
app.registerExtension({
  name: "Comfy.PyExec.DynamicGroupNode",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === NODE_TYPE) {
      this.extendNodePrototype(nodeType);
    }
  },

  extendNodePrototype(nodeType) {
    const originalOnCreated = nodeType.prototype.onNodeCreated;
    const originalDraw = nodeType.prototype.onDrawForeground;

    nodeType.prototype.onNodeCreated = async function() {
      const ret = originalOnCreated
          ? originalOnCreated.apply(this, arguments)
          : undefined;

      const node = this;
      if (!node.properties.inputs) {
        node.properties = structuredClone(DEFAULT_PROPERTIES);
        NodeHelper.createWidgets(node);
      }

      node.onPropertyChanged = (name, value) => {
        if (['inputs', 'widgets', 'outputs'].includes(name)) {
          NodeHelper.createWidgets(node);
          console.log("Property changed", name, value);
        }
      };

      return ret;
    };


    const iconSize = 14;
    const iconMargin = 4;
    nodeType.prototype.onDrawForeground = function(ctx) {
      const ret = originalDraw
          ? originalDraw.apply(this, arguments)
          : undefined;

      TypeRenderer.drawPortTypes(this, ctx);

      const x = this.size[0] - iconSize - iconMargin;
      const y = iconSize - 34;
      ctx.save();
      ctx.font = `${iconSize}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText('⚙️', x, y);
      ctx.restore();

      return ret;
    };

    // Переопределяем обработчик клика для определения нажатия по кнопке
    const origMouseDown = nodeType.prototype.onMouseDown;
    nodeType.prototype.onMouseDown = function (e, localPos) {
      const ret = origMouseDown ? origMouseDown.apply(this, arguments) : undefined;
      const x = this.size[0] - iconSize - iconMargin;
      const y = iconSize - 34;
      if (
        localPos[0] >= x &&
        localPos[0] <= x + iconSize &&
        localPos[1] >= y &&
        localPos[1] <= y + iconSize
      ) {
        const dlg = CustomizeDialog.getInstance();
        dlg.show(this);
        return true;
      }
      return ret;
    };
  }
});
