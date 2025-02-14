import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import {
  createWindowModal,
  makeElement,
  THEMES_MODAL_WINDOW,
} from "./utils.js";

// Constants
const MAX_CHAR_VARNAME = 50;

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
        // node.widgets = node.widgets.filter(widget => widget.name === 'pycode');
        node.properties.widgets.trim().split('\n').forEach(line => {
          const parts = line.trim().split(',');
          if(!parts.length) return;
          
          const type = parts[0].trim();
          const params = parts.slice(1).map(p => p.trim());
          
          switch(type.toUpperCase()) {
            case 'INT':
              if(params.length >= 5) node.addWidget('number', params[0], getWidgetValue(params[0], parseInt(params[1])), (v) => {callback(params[0], v)}, {min: parseInt(params[2]), max: parseInt(params[3]), step: parseInt(params[4]) * 10, round: 1, precision: 0});
              break;
              
            case 'FLOAT':
              if(params.length >= 5) node.addWidget('number', params[0], getWidgetValue(params[0], parseFloat(params[1])), (v) => {callback(params[0], v)}, {min: parseFloat(params[2]), max: parseFloat(params[3]), step: parseFloat(params[4]) * 10, precision: parseFloat(params[5])});
              break;
              
            case 'STRING':
              if(params.length >= 2) node.addWidget('string', params[0], getWidgetValue(params[0], params[1]), (v) => {callback(params[0], v)});
              break;
              
            case 'BOOLEAN':
              if(params.length >= 2) node.addWidget('toggle', params[0], getWidgetValue(params[0], params[1] === 'true'), (v) => {callback(params[0], v)});
              break;
              
            case 'COMBO':
              if(params.length >= 3) node.addWidget('combo', params[0], getWidgetValue(params[0], params[1]), (v) => {callback(params[0], v)}, {values: params.slice(2)});
              break;
          }
        });

        // let pycodeWidget = node.widgets.shift();
        // node.widgets.push(pycodeWidget);

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
            widgets: 'INT,My Age,30,0,100,1\n' +
                      'FLOAT,Weight,75.5,50,150,0.5,3\n' +
                      'STRING,Name,John\n' +
                      'BOOLEAN,Active,true\n' +
                      'COMBO,Gender,male,male,female',
            outputs: 'out11\nout2\nmy_age\nweight\nname\nactive\ngender',
            widgets_values: {} };
        }

        createWidgets(node);

        // this.setSize([currentWidth, this.size[1]]);
        // Reset py widget y location
        // node.widgets[0].y=0
        // node.setSize([530, node.size[1]]);

        node.onPropertyChanged = function (name, value)
        {
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

      // ExtraMenuOptions
      const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
      nodeType.prototype.getExtraMenuOptions = function (_, options) {
        getExtraMenuOptions?.apply(this, arguments);

        const past_index = options.length - 1;
        const past = options[past_index];

        // if (!!past)
        {
          function makeValidVariable(
            varName,
            textContent,
            regex = /^[a-z_][a-z0-9_]*$/i
          ) {
            if (
              !varName ||
              varName.trim() === "" ||
              varName.length > MAX_CHAR_VARNAME ||
              !regex.test(varName)
            ) {
              createWindowModal({
                textTitle: "WARNING",
                textBody: [
                  makeElement("div", {
                    style: { fontSize: "0.7rem" },
                    innerHTML: textContent,
                  }),
                ],
                ...THEMES_MODAL_WINDOW.warning,
                options: {
                  auto: {
                    autohide: true,
                    autoremove: true,
                    autoshow: true,
                    timewait: 1000,
                  },
                  close: { showClose: false },
                  overlay: { overlay_enabled: true },
                  parent: widget.codeElement,
                },
              });
  
              return false;
            }
            return true;
          }
          // Inputs remove
          for (const input_idx in this.inputs) {
            const input = this.inputs[input_idx];

            if (["language", "theme_highlight"].includes(input.name)) continue;
            
            options.splice(past_index + 1, 0, {
              content: `Remove Input ${input.name}`,
              callback: (e) => {
                const currentWidth = this.size[0];
                if (input.link) {
                  app.graph.removeLink(input.link);
                }
                this.removeInput(input_idx);
                this.setSize([currentWidth, this.size[1]]);
                
                // Reset py widget y location
                this.widgets[0].y=0
              },
            });
          }

          // Output remove
          for (const output_idx in this.outputs) {
            const output = this.outputs[output_idx];

            if (output.name === "result") continue;

            options.splice(past_index + 1, 0, {
              content: `Remove Output ${output.name}`,
              callback: (e) => {
                const currentWidth = this.size[0];
                if (output.link) {
                  app.graph.removeLink(output.link);
                }
                this.removeOutput(output_idx);
                this.setSize([currentWidth, this.size[1]]);

                // Reset py widget y location
                this.widgets[0].y=0
              },
            });
          }

          // Outputs remove
          options.splice(past_index + 1, 0, {
            content: `Add Output variable`,
            callback: (e) => {
              const currentWidth = this.size[0];

              // Output name variable
              const nameOutput = this?.outputs?.length
                ? `result${this.outputs.length + 1}`
                : "result1";
              const varName = prompt(
                "Enter output variable name:",
                nameOutput
              ).trim();

              // Check output variable name
              if (
                !makeValidVariable(
                  varName,
                  `<h3 style="margin: 0;">Variable for <span style="color: pink">Output</span> name is incorrect!</h3><ul style="text-align:left;padding: 2px;margin-left: 5%;"><li>starts with a number</li><li>has spaces or tabs</li><li>is empty</li><li>variable name is greater ${MAX_CHAR_VARNAME}</li></ul>`
                )
              )
                return;

              // Type variable and check
              let type = prompt(
                "Enter type data output (default: *):",
                "*"
              ).trim();

              if (
                !makeValidVariable(
                  type,
                  `<h3 style="margin: 0;">Type value is incorrect!</h3><ul style="text-align:left;padding: 2px;"><li>has spaces or tabs</li><li>is empty</li><li>type value length is greater ${MAX_CHAR_VARNAME}</li></ul>`,
                  /^[*a-z_][a-z0-9_]*$/i
                )
              )
                return;

              this.addOutput(varName, type);
              this.setSize([currentWidth, this.size[1]]);
              // Reset py widget y location
              this.widgets[0].y=0
            },
          });

          // Inputs add
          options.splice(past_index + 1, 0, {
            content: `Add Input variable`,
            callback: (e) => {
              // Input name variable and check
              const nameInput = this?.inputs?.length
              ? `var${this.inputs.length + 1}`
              : "var1";

              const varName = prompt(
                "Enter input variable name:",
                nameInput
              ).trim();

              if (
                !makeValidVariable(
                  varName,
                  `<h3 style="margin: 0;">Variable for <span style="color: limegreen">Input</span> name is incorrect!</h3><ul style="text-align:left;padding: 2px;margin-left: 5%;"><li>starts with a number</li><li>has spaces or tabs</li><li>is empty</li><li>variable name is greater ${MAX_CHAR_VARNAME}</li></ul>`
                )
              )
                return;

              // Type variable and check
              let type = prompt(
                "Enter type data output (default: *):",
                "*"
              ).trim();

              if (
                !makeValidVariable(
                  type,
                  `<h3 style="margin: 0;">Type value is incorrect!</h3><ul style="text-align:left;padding: 2px;"><li>has spaces or tabs</li><li>is empty</li><li>type value length is greater ${MAX_CHAR_VARNAME}</li></ul>`,
                  /^[*a-z_][a-z0-9_]*$/i
                )
              )
                return;

              const currentWidth = this.size[0];
              this.addInput(varName, type);
              this.setSize([currentWidth, this.size[1]]);
              // Reset py widget y location
              this.widgets[0].y=0
            },
          });
        }
      };
      // end - ExtraMenuOptions
    }
  },
});
