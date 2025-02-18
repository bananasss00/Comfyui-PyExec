import { app } from "../../../scripts/app.js";
import { TypeRenderer } from "./TypeRenderer.js";
import { NodeHelper } from "./NodeHelper.js";
import { CustomizeDialog } from "./CustomizeDialog.js";
import { decorateMethod, addTitleButton } from "./utils.js";

// Constants and helpers
const NODE_TYPES = ["DynamicGroupNode", "DynamicGroupNode_Output"];

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
  data: {
    links: [],
    widgets_as_inputs: [],
    widgets_values: {},
    nodes_template: ''
  }
};

const CUSTOMIZE_ICON_CONFIG = {
  icon: '⚙️',
  size: 14,
  margin: 4,
  offsetY: 14 - 34
};

const extendPrototype = (nodeType, methods) => {
  Object.entries(methods).forEach(([methodName, method]) => {
    decorateMethod(nodeType, methodName, method);
  });
}

const NodePrototypeExtensions = (nodeData) => ({
  onConnectionsChange: function (original, ...args) {
    const [ type, index, connected, link_info, ioSlot ] = args;
    const ret = original?.apply(this, args);

    console.log("Connections change", args);

    if (connected && ioSlot && link_info) {
      const existingEntry = this.properties.data.links.find(entry => entry[0] === ioSlot.name);
      if (!existingEntry) {
        this.properties.data.links.push([ioSlot.name, link_info.id]);
      } else {
        existingEntry[1] = link_info.id;
      }
    } 
    else if (!connected && ioSlot && link_info) {
      const indexToRemove = this.properties.data.links.findIndex(entry => entry[0] === ioSlot.name);
      if (indexToRemove !== -1) {
        this.properties.data.links.splice(indexToRemove, 1);
      }
    }

    return ret;
  },

  removeInput: function(original, ...args) {
    const [ slot ] = args;

    const input = this.inputs[slot];
    if (input.widget !== undefined) {
      const indexToRemove = this.properties.data.widgets_as_inputs.findIndex(entry => entry === input.name);
      if (indexToRemove !== -1) {
        this.properties.data.widgets_as_inputs.splice(indexToRemove, 1);
        console.log("removeInputWidget", input.name);
      }
    }

    const ret = original?.apply(this, args);
    return ret;
  },

  addInput: function(original, ...args) {
      const [ name, type, extra_info ] = args;
      const ret = original?.apply(this, args);

      const input = this.inputs.find(input => input.name === name);
      if (input?.widget !== undefined && this.properties.data.widgets_as_inputs.findIndex(entry => entry === name) === -1) {
        this.properties.data.widgets_as_inputs.push(name);
        console.log("addInputWidget", name);
      }

      return ret;
    },

  onConfigure: function(original, ...args) {
    const ret = original?.apply(this, args);

    this.onPropertyChanged = (name, value) => {
      if (['inputs', 'widgets', 'outputs'].includes(name)) {
        NodeHelper.createWidgets(nodeData, this);
        console.debug("Property changed", name, value);
      }
    };

    NodeHelper.createWidgets(nodeData, this);

    return ret;
  },
  
  onNodeCreated: function(original, ...args) {
    const ret = original?.apply(this, args);

    if (!this.properties.inputs) {
      this.properties = structuredClone(DEFAULT_PROPERTIES);
      NodeHelper.createWidgets(nodeData, this);
    }

    return ret;
  },

  onDrawForeground: function(original, ...args) {
    const [ ctx ] = args;
    const ret = original?.apply(this, args);

    TypeRenderer.drawPortTypes(this, ctx);

    return ret;
  }
});

// Register the extension
app.registerExtension({
  name: "Comfy.PyExec.DynamicGroupNode",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (NODE_TYPES.includes(nodeData.name)) {
      extendPrototype(nodeType, NodePrototypeExtensions(nodeData));
      addTitleButton(nodeType, CUSTOMIZE_ICON_CONFIG, node => 
        CustomizeDialog.getInstance().show(nodeData, node)
      );
    }
  },
});
