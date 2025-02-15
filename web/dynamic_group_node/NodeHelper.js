import { addMultilineWidget } from "./addMultilineWidget.js";

// Widget factory for different types of widgets
export const WIDGET_FACTORY = {
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

// Helper class to manage node widgets
export class NodeHelper {
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
