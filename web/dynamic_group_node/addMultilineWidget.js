import { app } from "../../../scripts/app.js";

// Function to add a multiline widget
export function addMultilineWidget(node, name, callback, opts) {
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
  widget.callback = callback;
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
