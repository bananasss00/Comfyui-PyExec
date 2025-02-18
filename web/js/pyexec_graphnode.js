import { app } from "../../../scripts/app.js";
  
const addMenuHandler = (nodeType, cb)=> {
	const getOpts = nodeType.prototype.getExtraMenuOptions;
	nodeType.prototype.getExtraMenuOptions = function () {
		const r = getOpts.apply(this, arguments);
		cb.apply(this, arguments);
		return r;
	};
}

function toVar(str, lower=true) {
    if (lower) {
        str = str.toLowerCase();
    }
    return str?.trim()
        .replace(/[^A-z0-9\s_]/g, '')
        .replace(/\s+/g, '_') ?? '';
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

    const deepClone = (obj, seen = new WeakMap()) => {
        if (obj === null || typeof obj !== 'object') return obj;
    
        if (seen.has(obj)) return seen.get(obj);
    
        const copy = Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj));
        seen.set(obj, copy);
    
        for (const key of Object.keys(obj)) {
            copy[key] = deepClone(obj[key], seen);
        }
    
        return copy;
    };

    const rewireAndRemoveReroutes = (nodes) => {
        const clonedNodes = nodes.map(node => deepClone(node));
        const reroutes = clonedNodes.filter(node => node.type === "Reroute");
        const connectionMap = {};
    
        reroutes.forEach(reroute => {
            const inputLink = reroute.inputs[0].link;
            const outputLinks = reroute.outputs[0].links;
            connectionMap[inputLink] = outputLinks;
        });
    
        clonedNodes.forEach(node => {
            Object.values(node.inputs).forEach(input => {
                const linkId = input.link;
                if (connectionMap[linkId]) {
                    input.link = connectionMap[linkId][0];
                }
            });
    
            Object.values(node.outputs).forEach(output => {
                output.links = output.links?.flatMap(linkId =>
                    connectionMap[linkId] || [linkId]
                );
            });
        });
    
        return clonedNodes.filter(node => node.type !== "Reroute");
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
            .filter(widget => {
                return (!widget.type?.startsWith('converted-') ?? true) && !widget.name.startsWith('control_before_generate') && !widget.name.startsWith('speak_and_recognation')
            })
            .map(widget => [
                widget.name,
                { ...widget, var: makeUniqueName(widget.name) }
            ])
    );

    const mapOutputs = (outputs = []) => Object.fromEntries(
        outputs.map(output => {
            const outputLinks = Array.isArray(output.links) ? output.links : [];

            const outputObj = {
                ...output,
                var: makeUniqueName(output.label || output.name),
                links: [...outputLinks]
            };
            outputLinks.forEach(link => (outLinks[link] = outputObj.var));
            return [output.name, outputObj];
        })
    );

    console.log(nodes);
    const nodeObjs = topologicalSort(rewireAndRemoveReroutes(Object.values(nodes)).map(createNodeObject));
    console.log(nodeObjs);
    
    nodeObjs.forEach(node => {
        const args = [`'${node.type}'`];

        Object.values(node.inputs).forEach(input => {
            const inputDef = `LINK_${input.type}_${input.link}`;
            args.push(`${input.name}=${outLinks[input.link] ?? inputDef}`);
        });

        Object.values(node.widgets).forEach(widget => {
            const value = 
                typeof widget.value === 'string' ? `r"${widget.value}"` :
                widget.value === true ? 'True' :
                widget.value === false ? 'False' :
                widget.value;
            vars[widget.var] = value;
            args.push(`${widget.name}=${widget.var}`);
        });

        code.push(`# ${node.title}\n${node.var} = graph.node(${args.join(', ')})`);

        Object.values(node.outputs).forEach((output, index) => {
            const links = output.links.join(', ');
            // code.push(`${output.var} = ${node.var}.out(${index}) # type: ${output.type}; links: ${links}`);
            code.push(`${output.var} = ${node.var}.out(${index})`);
        });

        code.push('');
    });

    const varsText = Object.entries(vars)
        .map(([key, value]) => `${key} = ${value}`)
        .join('\n');
    const codeStr = `# NODES_GROUP \n${varsText}\n\n${code.join('\n')}`;

    const newNode = app.graph.add(LiteGraph.createNode('PyExec_Output', 'PyExec_Output', {
        'pos': [...app.canvas.canvas_mouse]
    }));
    const py = newNode.widgets.find(w => w.name === 'pycode');
    py.value = codeStr;

    navigator.clipboard.writeText(codeStr).catch(err => console.error('Error:', err));
};

const copyGraphNodesDefinitions = (nodes) => {
    const names = new Set();
    const code = [];
    const vars = {};
    const outLinks = {};
    
    const createNodeObject = (node) => {
        const nodeObj = {
            title: node.title,
            var: toVar(node.constructor.type, false),
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
            { ...input, var: toVar(input.name) }
        ])
    );

    const mapWidgets = (widgets = []) => Object.fromEntries(
        widgets
            .filter(widget => {
                return (!widget.type?.startsWith('converted-') ?? true) && !widget.name.startsWith('control_before_generate') && !widget.name.startsWith('speak_and_recognation')
            })
            .map(widget => [
                widget.name,
                { ...widget, var: toVar(widget.name) }
            ])
    );

    const mapOutputs = (outputs = []) => Object.fromEntries(
        outputs.map(output => {
            const outputLinks = Array.isArray(output.links) ? output.links : [];

            const outputObj = {
                ...output,
                var: toVar(output.name),
                links: [...outputLinks]
            };
            outputLinks.forEach(link => (outLinks[link] = outputObj.var));
            return [output.name, outputObj];
        })
    );

    console.log(nodes);
    const nodeObjs = Object.values(nodes).map(createNodeObject);
    console.log(nodeObjs);
    
    nodeObjs.forEach(node => {
        const args = [];
        const vars = [];
        const out_comment = [];
        const out = [];

        Object.values(node.inputs).forEach(input => {
            const inputDef = `LINK_${input.type}`;
            args.push(`${input.name}`);
            // args.push(`${input.name}=${inputDef}`);
            vars.push(`${input.name}=${input.name}`);
        });

        Object.values(node.widgets).forEach(widget => {
            const value = 
                typeof widget.value === 'string' ? `r"${widget.value}"` :
                widget.value === true ? 'True' :
                widget.value === false ? 'False' :
                widget.value;
            args.push(`${widget.name}=${value}`);
            vars.push(`${widget.name}=${widget.name}`);
        });

        Object.values(node.outputs).forEach((output, index) => {
            out.push(`node.out(${index})`);
            out_comment.push( `${output.var}`);
        });

        code.push(`def ${node.var}(self, ${args.join(', ')}):`);
        if (out.length > 0) {
            code.push(`    '''`);
            code.push(`    return ${out_comment.join(', ')}`);
            code.push(`    '''`);
        }
        code.push(`    node = self.graph.node('${node.type}', ${vars.join(', ')})`);
        if (out.length > 0) {
            code.push(`    return ${out.join(', ')}`);
        }
        code.push('');
    });

    navigator.clipboard.writeText(code.join('\n')).catch(err => console.error('Error:', err));
};

function showSubMenu(value, options, e, menu, node) {
    const behaviorOptions = [
        {
            content: "Make Group Node",
            callback: () => {
                let graphcanvas = LGraphCanvas.active_canvas;
                if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                    copyGraphNodes([node]);
                } else {
                    copyGraphNodes(graphcanvas.selected_nodes);
                }
            }
        },
        {
            content: "Copy graph.node definitions",
            callback: () => {
                let graphcanvas = LGraphCanvas.active_canvas;
                if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
                    copyGraphNodesDefinitions([node]);
                } else {
                    copyGraphNodesDefinitions(graphcanvas.selected_nodes);
                }
            }
        }
    ];

    new LiteGraph.ContextMenu(behaviorOptions, {
        event: e,
        callback: null,
        parentMenu: menu,
        node: node
    });

    return false;  // This ensures the original context menu doesn't proceed
}

app.registerExtension({
	name: "PyExec.js.menu.GraphNode",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {

        addMenuHandler(nodeType, function (_, options) {
            options.unshift({
                content: "PyExec",
                has_submenu: true,
                callback: showSubMenu
            })
        })
	}
});