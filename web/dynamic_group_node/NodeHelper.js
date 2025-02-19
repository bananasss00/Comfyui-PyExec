import { addMultilineWidget } from "./addMultilineWidget.js";

// TODO: Convert to input, handle reload workflow

// Widget factory for different types of widgets
const createBaseWidget = (type, nodeData, node, widget, getValue, callback, extraConfig = {}) => {
  const config = [type, { 
      default: getValue(widget), 
      ...widget, 
      ...extraConfig 
  }];
  
  const w = app.widgets[type](node, widget.name, config, app);
  w.widget.callback = callback;
  nodeData.input.required[widget.name] = config;
  return w;
};

const WIDGET_FACTORY = {
  INT: (...args) => createBaseWidget('INT', ...args, { precision: 0 }),
  FLOAT: (...args) => createBaseWidget('FLOAT', ...args),
  STRING: (...args) => createBaseWidget('STRING', ...args),
  MSTRING: (...args) => createBaseWidget('STRING', ...args, { multiline: true }),
  BOOLEAN: (...args) => createBaseWidget('BOOLEAN', ...args),
  COMBO: (nodeData, node, widget, getValue, callback) => {
      const config = [widget.values, { default: getValue(widget) }];
      const w = app.widgets.COMBO(node, widget.name, config, app);
      w.widget.callback = callback;
      nodeData.input.required[widget.name] = config;
      return w;
  }
};

const logger = {
  debug: (...args) => console.debug('[NodeHelper]', ...args),
  warn: (...args) => console.warn('[NodeHelper]', ...args),
  error: (...args) => console.error('[NodeHelper]', ...args)
};

const parseConnections = (connectionString, defaultType = '*') => 
  connectionString.trim().split('\n').map(line => {
      const [name, type] = line.split(':').map(s => s.trim());
      return { name: name || line.trim(), type: (type || defaultType).toUpperCase() };
  });

// Helper class to manage node widgets
export class NodeHelper {
  static createWidgets(nodeData, node) {
    // TODO: rawLink, lazy inputs???

    // backup size
    const size = [node.size[0], node.size[1]];

    // create new fields
    if (!node.properties.data.labels) {
      node.properties.data.labels = {
        inputs: {},
        outputs: {},
        widgets: {}
      };
    }

    // create new fields
    NodeHelper.resetNodeElements(node);
    NodeHelper.createInputs(node);
    NodeHelper.createNodeWidgets(nodeData, node);
    NodeHelper.createOutputs(node);
    NodeHelper.restoreLinks(node);
    node.serialize();
    node.setSize(size);
  }

  static createInputs(node) {
    parseConnections(node.properties.inputs).forEach(({name, type}) => {
        const input = node.addInput(name, type);
        Object.defineProperty(input, 'label', {
          get: function() {
              return node.properties.data.labels.inputs[name] || name;
          },
          set: function(value) {
              node.properties.data.labels.inputs[name] = value;
          }
        });
    });
  }

  static createOutputs(node) {
    parseConnections(node.properties.outputs).forEach(({name, type}) => {
      const output = node.addOutput(name, type);
      Object.defineProperty(output, 'label', {
        get: function() {
            return node.properties.data.labels.outputs[name] || name;
        },
        set: function(value) {
            node.properties.data.labels.outputs[name] = value;
        }
      });
    });
  }

  static resetNodeElements(node) {
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
  }

  static restoreLinks(node) {
    node.properties.data.links.forEach(([name, link_id]) => {
      NodeHelper.restoreLink(node, link_id, name);
    });
  }

  static restoreLink(node, link_id, slotName) {
    const link = graph.links[link_id];
    if (!link) {
      console.warn(`Link ${link_id} not found`);
      return;
    }
    
    const origin_node = graph.getNodeById(link.origin_id);
    if (origin_node) {
      const entryIndex = node.inputs.findIndex(entry => entry.name === slotName);
      if (entryIndex !== -1/*node.inputs[link.target_slot]*/) {
        //node.inputs[link.target_slot].link = link_id;
        link.target_slot = entryIndex;
        node.inputs[entryIndex].link = link_id;
        app.graph.setDirtyCanvas(true);

        console.log(`Restored link ${link_id} from #${link.origin_id}:${link.origin_slot} to #${node.id}:${link.target_slot}`);
      }
    }
  }

  static createNodeWidgets(nodeData, node) {
      if (nodeData?.input?.required) {
        nodeData.input.required = {};
      }
      
      console.log(`widgets_as_inputs: ${node.properties.data.widgets_as_inputs}, widgets_values: ${node.properties.data.widgets_values}`);

      try {
          const widgetsConfig = JSON.parse(node.properties.widgets);
          widgetsConfig.forEach(config => {
              const widgetType = config.type?.toUpperCase();
              
              if (!widgetType || !WIDGET_FACTORY[widgetType]) {
                  logger.warn(`Skipping invalid widget:`, config);
                  return;
              }
              
              const callback = value => this.handleWidgetChange(node, config.name, value);
              const getValue = w => this.getWidgetValue(node, w);
              
              const creator = WIDGET_FACTORY[widgetType];
              const widget = creator(nodeData, node, config, getValue, callback);

              // handle converted widgets to input
              NodeHelper.handleWidgetConversion(node, widget.widget);
          });
      } catch (error) {
          logger.error('Widgets config parsing error:', error);
          throw new Error('Invalid widgets configuration');
      }
  }

  static handleWidgetConversion(node, widget) {
      const isConvertible = node.properties.data.widgets_as_inputs?.includes(
        widget.name
      );
      
      if (isConvertible && node.convertWidgetToInput(widget)) {
        console.log(`Converted widget to input: ${widget.name}`);

        const name = widget.name;
        const input = node.inputs.find(input => input.widget?.name === name);
        Object.defineProperty(input, 'label', {
          get: function() {
              return node.properties.data.labels.widgets[name] || name;
          },
          set: function(value) {
              console.log(`Setting label for widget ${name} to ${value}`);
              node.properties.data.labels.widgets[name] = value;
          }
        });
      }
  }

  static handleWidgetChange(node, name, value) {
      node.properties.data.widgets_values = node.properties.data.widgets_values || {};
      
      if (node.properties.data.widgets_values[name] !== value) {
          node.properties.data.widgets_values[name] = value;
          node.serialize();
          app.graph.setDirtyCanvas(true);
          logger.debug(`Widget updated: ${name} = ${value}`);
      }
  }

  static getWidgetValue(node, widget) {
    const defaultValue = this.parseValue(widget);
    return node.properties.data.widgets_values?.[widget.name] ?? defaultValue;
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
