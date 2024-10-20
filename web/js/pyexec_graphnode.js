import { app } from "../../../scripts/app.js";

const addMenuHandler = (nodeType, cb)=> {
	const getOpts = nodeType.prototype.getExtraMenuOptions;
	nodeType.prototype.getExtraMenuOptions = function () {
		const r = getOpts.apply(this, arguments);
		cb.apply(this, arguments);
		return r;
	};
}

const copyGraphNodes = function (nodes) {
    const code = [];

    for (let i in nodes) {
        const node = nodes[i];
        const nodeType = node.constructor.type;
        console.log(node);
        
        const args = [];
        args.push(`'${nodeType}'`);

        for (let j in node.inputs) {
            const input = node.inputs[j];
            args.push(`${input.name}=TYPE_${input.type}`);
        }

        for (let j in node.widgets) {
            const widget = node.widgets[j];
            if (widget.type.startsWith('converted-')) {
                continue;
            }
            const value = typeof widget.value === 'string' ? `"${widget.value}"` : widget.value;
            args.push(`${widget.name}=${value}`);
        }

        const outputs = [];
        for (let j in node.outputs) {
            const output = node.outputs[j];
            outputs.push(`${j}=${output.name}(${output.type})`);
        }

        code.push(`graph.node(${args.join(', ')}); // out: ${outputs.join(',')}`)
    }

    navigator.clipboard.writeText(code.join('\n'))
        .catch((err) => {
            console.error('Error: ', err);
        });
};

app.registerExtension({
	name: "PyExec.js.menu.GraphNode",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {

        addMenuHandler(nodeType, function (_, options) {
            options.unshift({
                content: "PyExec: Copy graph.node def",
                callback: (value, options, e, menu, node) => {
                    let graphcanvas = LGraphCanvas.active_canvas;
                    if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                        copyGraphNodes([node]);
                    } else {
                        copyGraphNodes(graphcanvas.selected_nodes);
                    }
                }
            })
        })
	}
});