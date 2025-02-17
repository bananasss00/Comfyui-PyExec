import { app } from "../../../scripts/app.js";
import { TypeRenderer } from "./TypeRenderer.js";
import { NodeHelper } from "./NodeHelper.js";
import { CustomizeDialog } from "./CustomizeDialog.js";

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
  widgets_as_inputs: [],
  widgets_values: {},
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
  nodes_template: ''
};

function addCustomizeIcon(nodeType, nodeData) {
  const options = {
    icon: '⚙️',
    size: 14,
    margin: 4,
    offsetY: 14 - 34,
    onClick: (node) => {
      const dlg = CustomizeDialog.getInstance();
      dlg.show(nodeData, node);
    }
  };

  // Сохраняем оригинальные методы, если они заданы
  const originalDraw = nodeType.prototype.onDrawForeground;
  const originalMouseDown = nodeType.prototype.onMouseDown;

  nodeType.prototype.onDrawForeground = function(ctx) {
    const ret = originalDraw ? originalDraw.apply(this, arguments) : undefined;

    if (this.flags?.collapsed) return ret;

    const x = this.size[0] - options.size - options.margin;
    const y = options.offsetY;
    ctx.save();
    ctx.font = `${options.size}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(options.icon, x, y);
    ctx.restore();

    return ret;
  };

  nodeType.prototype.onMouseDown = function(e, localPos) {
    const ret = originalMouseDown ? originalMouseDown.apply(this, arguments) : undefined;
    if (this.flags?.collapsed) return ret;

    const x = this.size[0] - options.size - options.margin;
    const y = options.offsetY;
    if (
      localPos[0] >= x &&
      localPos[0] <= x + options.size &&
      localPos[1] >= y &&
      localPos[1] <= y + options.size
    ) {
      options.onClick(this);
      return true;
    }
    return ret;
  };
}

// Register the extension
app.registerExtension({
  name: "Comfy.PyExec.DynamicGroupNode",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (NODE_TYPES.includes(nodeData.name)) {
      this.extendNodePrototype(nodeType, nodeData);
      addCustomizeIcon(nodeType, nodeData);
    }
  },

  extendNodePrototype(nodeType, nodeData) {
    const originalOnCreated = nodeType.prototype.onNodeCreated;
    const originalDraw = nodeType.prototype.onDrawForeground;
    const originalConnectionsChange = nodeType.prototype.onConnectionsChange

    // handle converted widgets to inputs
    nodeType.prototype.onConnectionsChange = async function (type, index, connected, link_info, ioSlot) {
      const ret = originalConnectionsChange
        ? originalConnectionsChange.apply(this, arguments)
        : undefined;
    
      console.log("Connections change", arguments);

      if (connected && ioSlot?.widget !== undefined) {
        const existingEntry = this.properties.widgets_as_inputs.find(entry => entry[0] === ioSlot.name);
        if (!existingEntry) {
          this.properties.widgets_as_inputs.push([ioSlot.name, link_info.id]);
        }
      } else if (!connected && ioSlot?.widget !== undefined) {
        // Remove widget name and link_info.id from inputWidgets if present
        const indexToRemove = this.properties.widgets_as_inputs.findIndex(entry => entry[0] === ioSlot.name);
        if (indexToRemove !== -1) {
          this.properties.widgets_as_inputs.splice(indexToRemove, 1);
        }
      }
    
      return ret;
    }


    nodeType.prototype.onNodeCreated = async function() {
      const ret = originalOnCreated
          ? originalOnCreated.apply(this, arguments)
          : undefined;

      const node = this;
      if (!node.properties.inputs) {
        node.properties = structuredClone(DEFAULT_PROPERTIES);
        NodeHelper.createWidgets(nodeData, node);
      }

      node.onPropertyChanged = (name, value) => {
        if (['inputs', 'widgets', 'outputs'].includes(name)) {
          NodeHelper.createWidgets(nodeData, node);
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
