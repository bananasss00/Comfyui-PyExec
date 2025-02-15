import { addMultilineWidget } from "./addMultilineWidget.js";

// TODO: Convert to input, handle reload workflow

// Widget factory for different types of widgets
export const WIDGET_FACTORY = {
  INT: (nodeData, node, widget, getValue, callback) => {
    const config = ['INT', {default: getValue(widget), min: widget.min, max: widget.max, step: widget.step}];
    const w = app.widgets['INT'](node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = node.addWidget('number', widget.name, getValue(widget), callback, {
    //   min: Number(widget.min),
    //   max: Number(widget.max),
    //   step: Number(widget.step) * 10,
    //   round: 1,
    //   precision: 0
    // });
    // Object.assign(
    //   w,
    //   app.widgets['INT'](node, widget.name, ['INT', {min: widget.min, max: widget.max, step: widget.step}], app) || {}
    // )
  },

  FLOAT: (nodeData, node, widget, getValue, callback) => {
    const config = ['FLOAT', {default: getValue(widget), min: widget.min, max: widget.max, step: widget.step}];
    const w = app.widgets['FLOAT'](node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = node.addWidget('number', widget.name, getValue(widget), callback, {
    //   min: Number(widget.min),
    //   max: Number(widget.max),
    //   step: Number(widget.step) * 10,
    //   precision: Number(widget.precision) || 3
    // });
    // Object.assign(
    //   w,
    //   app.widgets['FLOAT'](node, widget.name, ['FLOAT', {min: widget.min, max: widget.max, step: widget.step}], app) || {}
    // )
  },

  STRING: (nodeData, node, widget, getValue, callback) => {
    const config = ['STRING', {default: getValue(widget)}];
    const w = app.widgets['STRING'](node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = node.addWidget('string', widget.name, getValue(widget), callback);
    // Object.assign(
    //   w,
    //   app.widgets['STRING'](node, widget.name, ['STRING', {}], app) || {}
    // )
  },

  MSTRING: (nodeData, node, widget, getValue, callback) => {
    const config = ['STRING', {default: getValue(widget), multiline: true}];
    const w = app.widgets['STRING'](node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = addMultilineWidget(node, widget.name, callback, {defaultVal: getValue(widget)});
    // Object.assign(
    //   w,
    //   app.widgets['MSTRING'](node, widget.name, ['STRING', {multiline: true}], app) || {}
    // )
  },

  BOOLEAN: (nodeData, node, widget, getValue, callback) => {
    const config = ['BOOLEAN', {default: getValue(widget)}];
    const w = app.widgets['BOOLEAN'](node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = node.addWidget('toggle', widget.name, getValue(widget), callback);
    // Object.assign(
    //   w,
    //   app.widgets['BOOLEAN'](node, widget.name, ['BOOLEAN', {}], app) || {}
    // )
  },

  COMBO: (nodeData, node, widget, getValue, callback) => {
    const config = [widget.values, {default: getValue(widget)}];
    const w = app.widgets.COMBO(node, widget.name, config, app);
    w.widget.callback = callback;
    nodeData.input.required[widget.name] = config;

    // const w = node.addWidget('combo', widget.name, getValue(widget), callback, {
    //   values: widget.values
    // });
    // Object.assign(
    //   w,
    //   app.widgets.COMBO(node, widget.name, [widget.values, {}], app) || {}
    // )
  }
};

// Helper class to manage node widgets
export class NodeHelper {
  static createWidgets(nodeData, node) {
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
    NodeHelper.createNodeWidgets(nodeData, node);

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

  static createNodeWidgets(nodeData, node) {
    try {
      nodeData.input.required = {};
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

        factory(nodeData, node, widget, getValue, callback);
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
