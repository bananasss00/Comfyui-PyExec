import { app } from "../../../scripts/app.js";

const addMenuHandler = (nodeType, cb)=> {
	const getOpts = nodeType.prototype.getExtraMenuOptions;
	nodeType.prototype.getExtraMenuOptions = function () {
		const r = getOpts.apply(this, arguments);
		cb.apply(this, arguments);
		return r;
	};
}

function toVar(str) {
    return str
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_]/g, '')
        .replace(/\s+/g, '_');
}

const copyGraphNodes = (nodes) => {
    const names = new Set();
    const code = [];
    const vars = {};
    const outLinks = {};
    
    const makeUniqueName = (name) => {
        let uniqueName = toVar(name);
        let counter = 1;
        while (names.has(uniqueName)) {
            uniqueName = `${toVar(name)}_${counter++}`;
        }
        names.add(uniqueName);
        return uniqueName;
    };

    const topologicalSort = (nodes) => {
        const graph = new Map(nodes.map(node => [node, []]));
        const inDegree = new Map(nodes.map(node => [node, 0]));

        nodes.forEach(node => {
            Object.values(node.outputs || {}).forEach(output => {
                output.links.forEach(link => {
                    nodes.forEach(target => {
                        if (Object.values(target.inputs || {}).some(input => input.link === link)) {
                            graph.get(node).push(target);
                            inDegree.set(target, inDegree.get(target) + 1);
                        }
                    });
                });
            });
        });

        const stack = [...nodes.filter(node => inDegree.get(node) === 0)];
        const sortedList = [];

        while (stack.length) {
            const current = stack.pop();
            sortedList.push(current);
            graph.get(current).forEach(neighbor => {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) stack.push(neighbor);
            });
        }

        return sortedList;
    };

    const createNodeObject = (node) => {
        const nodeObj = {
            title: node.title,
            var: makeUniqueName(node.title),
            type: node.constructor.type,
            inputs: mapInputs(node.inputs),
            widgets: mapWidgets(node.widgets),
            outputs: mapOutputs(node.outputs)
        };
        return nodeObj;
    };

    const mapInputs = (inputs = []) => Object.fromEntries(
        inputs.map(input => [
            input.name,
            { ...input, var: makeUniqueName(input.label || input.name) }
        ])
    );

    const mapWidgets = (widgets = []) => Object.fromEntries(
        widgets
            .filter(widget => !widget.type.startsWith('converted-'))
            .map(widget => [
                widget.name,
                { ...widget, var: makeUniqueName(widget.name) }
            ])
    );

    const mapOutputs = (outputs = []) => Object.fromEntries(
        outputs.map(output => {
            const outputObj = {
                ...output,
                var: makeUniqueName(output.label || output.name),
                links: [...output.links]
            };
            output.links.forEach(link => (outLinks[link] = outputObj.var));
            return [output.name, outputObj];
        })
    );

    const nodeObjs = topologicalSort(Object.values(nodes).map(createNodeObject));

    nodeObjs.forEach(node => {
        const args = [`'${node.type}'`];

        Object.values(node.inputs).forEach(input => {
            const inputDef = `LINK_${input.type}_${input.link}`;
            args.push(`${input.name}=${outLinks[input.link] ?? inputDef}`);
        });

        Object.values(node.widgets).forEach(widget => {
            const value = typeof widget.value === 'string' ? `r"${widget.value}"` : widget.value;
            vars[widget.var] = value;
            args.push(`${widget.name}=${widget.var}`);
        });

        code.push(`# ${node.title}\n${node.var} = graph.node(${args.join(', ')})`);

        Object.values(node.outputs).forEach((output, index) => {
            const links = output.links.join(', ');
            code.push(`${output.var} = ${node.var}.out(${index}) # type: ${output.type}; links: ${links}`);
        });

        code.push('');
    });

    const varsText = Object.entries(vars)
        .map(([key, value]) => `${key} = ${value}`)
        .join('\n');
    const codeStr = `${varsText}\n\n${code.join('\n')}`;

    const newNode = app.graph.add(LiteGraph.createNode('PyExec_Output', 'PyExec_Output', {
        'pos': [...app.canvas.canvas_mouse]
    }));
    const py = newNode.widgets.find(w => w.name === 'py');
    py.value = codeStr;

    navigator.clipboard.writeText(codeStr).catch(err => console.error('Error:', err));
};


app.registerExtension({
	name: "PyExec.js.menu.GraphNode",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {

        addMenuHandler(nodeType, function (_, options) {
            options.unshift({
                content: "PyExec: Make Group Node",
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