import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Константы и хелперы
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
    { type: 'BOOLEAN', name: 'Active', value: 'true' },
    { type: 'COMBO', name: 'Gender', value: 'male', values: ['male', 'female'] }
  ], null, 4),
  outputs: 'out1: STRING\nout2: INT\nmy_age: INT\nweight: FLOAT\nname: STRING\nactive: BOOLEAN\ngender: STRING',
  widgets_values: {}
};

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
  
  BOOLEAN: (node, widget, getValue, callback) =>
    node.addWidget('toggle', widget.name, getValue(widget), callback),
  
  COMBO: (node, widget, getValue, callback) =>
    node.addWidget('combo', widget.name, getValue(widget), callback, {
      values: widget.values
    })
};

class NodeHelper {
  static createWidgets(node) {
    const currentLinks = node.inputs.map(input => input.link);
    console.log(currentLinks);

    // Очистка предыдущих элементов
    node.inputs = [];
    node.widgets = [];
    node.outputs = [];

    // Создание входов
    NodeHelper.createInputs(node);

    // Восстановление значений link
    node.inputs.forEach((input, index) => {
      if (currentLinks[index]) {
        input.link = currentLinks[index];
        console.log(`Link restored for input ${index}:`, input.link);
      }
    });
    
    // Создание виджетов
    NodeHelper.createNodeWidgets(node);
    
    // Создание выходов
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

    nodeType.prototype.onDrawForeground = function(ctx) {
      const ret = originalDraw
          ? originalDraw.apply(this, arguments)
          : undefined;

      TypeRenderer.drawPortTypes(this, ctx);

      return ret;
    };
  }
});
