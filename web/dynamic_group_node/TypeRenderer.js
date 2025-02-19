// Class to render node types
export class TypeRenderer {
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

      // latest ComfyUI-FrontEnd fix
      let posY = index * 20 + 19;
      if (output._layoutElement?.boundingRect) {
        const [ x, y, width, height ] = output._layoutElement.boundingRect;
        posY = y + height / 2;
        ctx.textBaseline = "middle";
      }

      TypeRenderer.drawTypeLabel(ctx, type, color, {
        x: node.size[0] - ctx.measureText(output.label || output.name).width - 25,
        y: posY,
        align: "right"
      });
    });
  }

  static drawInputTypes(node, ctx) {
    node.inputs?.forEach((input, index) => {
      const type = input.type === "*" ? "any" : input.type.toLowerCase();
      const color = LGraphCanvas.link_type_colors[input.type.toUpperCase()] || "#AAA";

      // latest ComfyUI-FrontEnd fix
      let posY = index * 20 + 19;
      if (input._layoutElement?.boundingRect) {
        const [ x, y, width, height ] = input._layoutElement.boundingRect;
        posY = y + height / 2;
        ctx.textBaseline = "middle";
      }

      TypeRenderer.drawTypeLabel(ctx, type, color, {
        x: 25 + ctx.measureText(input.label || input.name).width,
        y: posY,
        align: "left"
      });
      
    });
  }

  static drawTypeLabel(ctx, text, color, { x, y, align }) {
    ctx.fillStyle = color;
    ctx.font = "12px Arial, sans-serif";
    ctx.textAlign = align;
    ctx.fillText(`[${text}]`, x, y);
  }
}
