import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

function createWidgets(node) {
  node.inputs = [];
  node.properties.inputs.trim().split('\n').forEach(element => {
    node.addInput(element, "*");
  });

  function callback(name, value) {
    if (!node.properties.widgets_values) {
      node.properties.widgets_values = {};
    }
    node.properties.widgets_values[name] = value;
    console.log(name, value);
    node.serialize();
  }

  function getWidgetValue(name, defaultValue) {
    if (node.properties.widgets_values && node.properties.widgets_values[name] !== undefined) {
      console.log('getWidgetValue', name, node.properties.widgets_values[name]);
      return node.properties.widgets_values[name];
    }
    return defaultValue;
  }

  node.widgets = [];
  JSON.parse(node.properties.widgets).forEach(widget => {
    const type = widget.type.toUpperCase();

    switch (type) {
      case 'INT':
        node.addWidget('number', widget.name, getWidgetValue(widget.name, parseInt(widget.value)), (v) => { callback(widget.name, v) }, { min: parseInt(widget.min), max: parseInt(widget.max), step: parseInt(widget.step) * 10, round: 1, precision: 0 });
        break;

      case 'FLOAT':
        node.addWidget('number', widget.name, getWidgetValue(widget.name, parseFloat(widget.value)), (v) => { callback(widget.name, v) }, { min: parseFloat(widget.min), max: parseFloat(widget.max), step: parseFloat(widget.step) * 10, precision: parseFloat(widget.precision) });
        break;

      case 'STRING':
        node.addWidget('string', widget.name, getWidgetValue(widget.name, widget.value), (v) => { callback(widget.name, v) });
        break;

      case 'BOOLEAN':
        node.addWidget('toggle', widget.name, getWidgetValue(widget.name, widget.value === 'true'), (v) => { callback(widget.name, v) });
        break;

      case 'COMBO':
        node.addWidget('combo', widget.name, getWidgetValue(widget.name, widget.value), (v) => { callback(widget.name, v) }, { values: widget.values });
        break;
    }
  });

  node.outputs = node.outputs.filter(output => output.name === 'result');
  node.properties.outputs.trim().split('\n').forEach(element => {
    node.addOutput(element, "*");
  });
}

// Register extensions
app.registerExtension({
  name: "Comfy.PyExec.DynamicGroupNode",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === "DynamicGroupNode") {
      // Node Created
      const onNodeCreated = nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated = async function () {
        const ret = onNodeCreated
          ? onNodeCreated.apply(this, arguments)
          : undefined;

        const node_title = await this.getTitle();
        const nodeName = `${nodeData.name}_${this.id}`;
        const node = this;

        console.log(`Create ${nodeData.name}: ${nodeName}`);
        this.name = nodeName;

        if (!node.properties.inputs) {
          node.properties = {
            pycode: '',
            inputs: 'var1\nvar2',
            widgets: JSON.stringify([
              { type: 'INT', name: 'My Age', value: '30', min: '0', max: '100', step: '1' },
              { type: 'FLOAT', name: 'Weight', value: '75.5', min: '50', max: '150', step: '0.5', precision: '3' },
              { type: 'STRING', name: 'Name', value: 'John' },
              { type: 'BOOLEAN', name: 'Active', value: 'true' },
              { type: 'COMBO', name: 'Gender', value: 'male', values: ['male', 'female'] }
            ], null, 4),
            outputs: 'out11\nout2\nmy_age\nweight\nname\nactive\ngender',
            widgets_values: {}
          };
        }

        createWidgets(node);

        node.onPropertyChanged = function (name, value) {
          console.log('Property changed:', name, value);
          createWidgets(node);
        }

        return ret;
      };

      const onDrawForeground = nodeType.prototype.onDrawForeground;
      nodeType.prototype.onDrawForeground = function (ctx) {
        const r = onDrawForeground?.apply?.(this, arguments);

        if (this.flags?.collapsed) return r;

        if (this?.outputs?.length) {
          for (let o = 0; o < this.outputs.length; o++) {
            const { name, type } = this.outputs[o];
            const colorType = LGraphCanvas.link_type_colors[type.toUpperCase()];
            const nameSize = ctx.measureText(name);
            const typeSize = ctx.measureText(
              `[${type === "*" ? "any" : type.toLowerCase()}]`
            );

            ctx.fillStyle = colorType === "" ? "#AAA" : colorType;
            ctx.font = "12px Arial, sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(
              `[${type === "*" ? "any" : type.toLowerCase()}]`,
              this.size[0] - nameSize.width - typeSize.width,
              o * 20 + 19
            );
          }
        }

        if (this?.inputs?.length) {
          for (let i = 0; i < this.inputs.length; i++) {
            const { name, type } = this.inputs[i];
            const colorType = LGraphCanvas.link_type_colors[type.toUpperCase()];
            const nameSize = ctx.measureText(name);

            ctx.fillStyle = colorType === "" ? "#AAA" : colorType;
            ctx.font = "12px Arial, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(
              `[${type === "*" ? "any" : type.toLowerCase()}]`,
              nameSize.width + 25,
              i * 20 + 19
            );
          }
        }
        return r;
      };
    }
  },
});