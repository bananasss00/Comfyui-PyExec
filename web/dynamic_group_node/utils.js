export const decorateMethod = (target, methodName, wrapper) => {
  const original = target.prototype[methodName];
  target.prototype[methodName] = function (...args) {
    return wrapper.call(this, original, ...args);
  };
};

export const addTitleButton = (nodeType, iconConfig, onClick) => {
  decorateMethod(nodeType, 'onDrawForeground', function (original, ...args) {
    const [ctx] = args;

    const ret = original?.apply(this, args);
    if (this.flags.collapsed) return ret;

    const { icon, size, margin, offsetY } = iconConfig;
    const x = this.size[0] - size - margin;
    const y = offsetY;

    ctx.save();
    ctx.font = `${size}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(icon, x, y);
    ctx.restore();

    return ret;
  });

  decorateMethod(nodeType, 'onMouseDown', function (original, ...args) {
    const [event, pos] = args;
    const { icon, size, margin, offsetY } = iconConfig;
    const iconRect = {
      x: this.size[0] - size - margin,
      y: offsetY,
      width: size,
      height: size
    };

    if (pos[0] >= iconRect.x &&
      pos[0] <= iconRect.x + iconRect.width &&
      pos[1] >= iconRect.y &&
      pos[1] <= iconRect.y + iconRect.height) {
      onClick(this);
      return true;
    }

    return original?.apply(this, args);
  });
};
