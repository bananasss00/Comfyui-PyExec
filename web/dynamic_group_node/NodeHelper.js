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
    // const currentLinks = node.inputs.map(input => ({link_id: input.link, name: input.name}));
    // console.log('currentLinks', currentLinks, node);

    // TODO: rawLink, lazy inputs???

    NodeHelper.resetNodeElements(node);
    NodeHelper.createInputs(node);
    NodeHelper.createNodeWidgets(nodeData, node);
    NodeHelper.createOutputs(node);
    NodeHelper.restoreLinks(node);

    node.serialize();
  }

  static createInputs(node) {
    parseConnections(node.properties.inputs).forEach(({name, type}) => 
        node.addInput(name, type));
  }

  static createOutputs(node) {
    parseConnections(node.properties.outputs).forEach(({name, type}) => 
        node.addOutput(name, type));
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
    node.properties.links.forEach(([name, link_id]) => {
      NodeHelper.restoreLink(node, link_id, name);
    });
      // currentLinks.forEach(({link_id, name}) => {
      //     NodeHelper.restoreLink(node, link_id, name);
      // });
    

      // node.inputs.forEach((input, index) => {
      //     if (currentLinks[index]) {
      //         input.link = currentLinks[index];
      //         app.graph.setDirtyCanvas(true);
      //     }
      // });
  }

  static restoreLink(node, link_id, slotName) {
    const link = graph.links[link_id];
    if (!link) {
      console.warn(`Link ${link_id} not found`);
      return;
    }
    
    const origin_node = graph.getNodeById(link.origin_id);
    if (origin_node) {
      // graph.links.delete(link_id);
      // origin_node?.connect(link.origin_slot, node, link.target_slot);

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
      
      console.log(`widgets_as_inputs: ${node.properties.widgets_as_inputs}, widgets_values: ${node.properties.widgets_values}`);

      try {
          const widgetsConfig = JSON.parse(node.properties.widgets);
          widgetsConfig.forEach(widget => {
              const type = widget.type?.toUpperCase();
              
              if (!type || !WIDGET_FACTORY[type]) {
                  logger.warn(`Skipping invalid widget:`, widget);
                  return;
              }
              
              const callback = value => this.handleWidgetChange(node, widget.name, value);
              const getValue = w => this.getWidgetValue(node, w);
              
              const w = WIDGET_FACTORY[type](nodeData, node, widget, getValue, callback);

              // handle converted widgets to input
              const widgetInputEntry = node.properties.widgets_as_inputs?.find(entry => entry === w.widget.name);
              if (widgetInputEntry && node.convertWidgetToInput(w.widget)) {
                console.log(`Converted widget ${w.widget.name} to input`);
              }
          });
      } catch (error) {
          logger.error('Widgets config parsing error:', error);
          throw new Error('Invalid widgets configuration');
      }
  }

  static handleWidgetChange(node, name, value) {
      node.properties.widgets_values = node.properties.widgets_values || {};
      
      if (node.properties.widgets_values[name] !== value) {
          node.properties.widgets_values[name] = value;
          node.serialize();
          app.graph.setDirtyCanvas(true);
          logger.debug(`Widget updated: ${name} = ${value}`);
      }
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
