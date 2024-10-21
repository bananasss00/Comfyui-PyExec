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
    .trim() // Удаляем пробелы в начале и конце
    .toLowerCase() // Преобразуем все символы в нижний регистр
    .replace(/[^a-z0-9\s]/g, '') // Удаляем все символы, кроме букв, цифр и пробелов
    .replace(/\s+/g, '_'); // Заменяем одно или несколько пробелов на подчеркивание
}

// function toVar(title) {
//     return title
//       // Убираем все символы, кроме букв, цифр и пробелов
//       .replace(/[^a-zA-Z0-9\s]/g, '')
//       // Разбиваем на слова по пробелам
//       .trim()
//       .split(/\s+/)
//       // Преобразуем в camelCase
//       .map((word, index) =>
//         index === 0
//           ? word.toLowerCase() // Первое слово с маленькой буквы
//           : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() // Остальные с большой буквы
//       )
//       .join('');
// }

const copyGraphNodes = (nodes) => {
    const names = new Set();
    const code = [];
    const vars = {};

    const makeUniqueName = (name) => {
        name = toVar(name);
        let uniqueName = name;
        let counter = 1;

        while (names.has(uniqueName)) {
            uniqueName = `${name}_${counter++}`;
        }

        names.add(uniqueName);

        return uniqueName;
    };

    function topologicalSort(nodes) {
        const graph = new Map();
        const inDegree = new Map();
        
        // Инициализация графа и степени входа для каждого узла
        nodes.forEach(node => {
            graph.set(node, []);
            inDegree.set(node, 0);
        });
        
        // Построение графа и подсчет входящих ребер
        nodes.forEach(node => {
            const outputs = node.outputs;
            const inputs = node.inputs;
    
            if (outputs) {
                Object.values(outputs).forEach(output => {
                    output.links.forEach(outId => {
                        nodes.forEach(n => {
                            Object.values(n.inputs).forEach(input => {
                                if (input.link === outId) {
                                    graph.get(node).push(n);
                                    inDegree.set(n, inDegree.get(n) + 1);
                                }
                            });
                        });
                    });
                });
            }
        });
    
        // Поиск узлов с нулевой степенью входа
        const stack = [];
        inDegree.forEach((degree, node) => {
            if (degree === 0) {
                stack.push(node);
            }
        });
    
        const sortedList = [];
        
        // Топологическая сортировка
        while (stack.length > 0) {
            const current = stack.pop();
            sortedList.push(current);
    
            graph.get(current).forEach(neighbor => {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) {
                    stack.push(neighbor);
                }
            });
        }
    
        return sortedList;
    }


    console.log(nodes);

    let nodeObjs = [];
    const outLinks = {};

    for (const i in nodes) {
        const node = nodes[i];
        const { type: nodeType } = node.constructor;
        const args = [`'${nodeType}'`];
        
        const nodeObj = {};
        nodeObj.title = node.title;
        nodeObj.var = makeUniqueName(nodeObj.title);
        nodeObj.type = nodeType;
        nodeObj.inputs = {};
        nodeObj.widgets = {};
        nodeObj.outputs = {};

        node.inputs.forEach(input => {
            const o = nodeObj.inputs[input.name] = {};
            o.name = input.name;
            o.label = input.label;
            o.var = makeUniqueName(o.label ?? o.name);
            o.type = input.type;
            o.link = input.link;
        });

        node.widgets?.forEach(widget => {
            if (widget.type.startsWith('converted-'))
                return;
            const o = nodeObj.widgets[widget.name] = {};
            o.name = widget.name;
            o.var = makeUniqueName(o.name);
            o.type = widget.type;
            o.value = widget.value;
        });
        
        node.outputs.forEach(output => {
            const o = nodeObj.outputs[output.name] = {};
            o.name = output.name;
            o.label = output.label;
            o.var = makeUniqueName(o.label ?? o.name);
            o.type = output.type;
            o.links = [];
            for (let j in output.links) {
                const link = output.links[j];
                o.links.push(link);
                outLinks[link] = o.var;
            }
        });
        nodeObjs.push(nodeObj);
    }

    nodeObjs = topologicalSort(nodeObjs);
    console.log(nodeObjs);
    
    for (const i in nodeObjs) {
        console.log(i);
        const node = nodeObjs[i];
        const nodeType = node.type;
        const args = [`'${nodeType}'`];
        
        // console.log(node);

        Object.values(node.inputs).forEach(input => {
            const def = `LINK_${input.type}_${input.link}`;
            args.push(`${input.name}=${outLinks[input.link] ?? def}`)
        });

        Object.values(node.widgets).forEach(widget => {
            const value = typeof widget.value === 'string' 
                ? `r"${widget.value}"` 
                : widget.value;
            const uniqueName = widget.var;

            vars[uniqueName] = value;
            args.push(`${widget.name}=${uniqueName}`);
        });

        const nodeVar = node.var;
        code.push(`# ${node.title}\n${nodeVar}=graph.node(${args.join(', ')})`);
        for (let j in Object.values(node.outputs)) {
            const output = Object.values(node.outputs)[j];

            const links = output.links.map(
                (link, index) => `${link}`
            );
            code.push(`${output.var}=${nodeVar}.out(${j}) # type: ${output.type}; links: ${links.join(', ')}`);
        }
        code.push('');
    }

    const varsText = Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    const codeStr = `${varsText}\n\n${code.join('\n')}`;

    const newNode = app.graph.add(LiteGraph.createNode('PyExec_Output', 'PyExec_Output'));
    const py = newNode.widgets.find((nw) => nw.name === 'py');
    py.value = codeStr;

    navigator.clipboard.writeText(codeStr)
        .catch(err => console.error('Error:', err));

    

    
    // for (const i in nodes) {
    //     const node = nodes[i];
    //     console.log(`${node.title}(${node.id})`);

    //     node.inputs.forEach(input => 
    //         console.log(`${input.name}=${input.link}`)
    //     );

    //     node.outputs.forEach(function (output) {
    //             for (const j in output.links) {
    //                 const link = output.links[j];
    //                 console.log(`[${j}]=${link}`)
    //             }
    //         }
    //     );
    // }
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