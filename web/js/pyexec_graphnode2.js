import { app } from "../../../scripts/app.js";
import { NodeHelper } from "../dynamic_group_node/NodeHelper.js";

const NODE_TYPES = {
    REROUTE: "Reroute",
    PY_EXEC_OUTPUT: "DynamicGroupNode_Output"
};

const topologicalSort = (nodes) => {
    const graph = new Map(nodes.map(node => [node, []]));
    const inDegree = new Map(nodes.map(node => [node, 0]));
  
    nodes.forEach(node => {
      Object.values(node.outputs || {}).forEach(output => {
        output.links?.forEach(link => {
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
  
  const processRerouteNodes = (nodes) => {
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
        output.links = output.links?.flatMap(linkId => connectionMap[linkId] || [linkId]);
      });
    });
  
    return clonedNodes.filter(node => node.type !== "Reroute");
  };
  
  class UnifiedCodeGenerator {
    constructor(nodes) {
      this.nodes = nodes;
      this.usedNames = new Set();
    }
  
    sanitizeName(name, lower=false) {
        if (lower) {
            name = name?.toLowerCase();
        }
        return name?.trim()
            .replace(/[^A-z0-9\s_]/g, '')
            .replace(/\s+/g, '_') ?? '';
    }
  
    createUniqueName(base) {
      let name = this.sanitizeName(base);
      let counter = 1;
  
      while (this.usedNames.has(name)) {
        name = `${this.sanitizeName(base)}_${counter++}`;
      }
  
      this.usedNames.add(name);
      return name;
    }
  
    formatValue(value) {
      if (typeof value === 'string') return `"${value.replace(/"/g, '\\"').replace(/\\/g, '\\\\')}"`;
      if (value === true) return 'True';
      if (value === false) return 'False';
      if (Array.isArray(value)) return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
      return value;
    }
  
    generateTypeGroups() {
      const processedNodes = topologicalSort(processRerouteNodes(Object.values(this.nodes)));
      const typeGroups = {};
  
      processedNodes.forEach(node => {
        if (!typeGroups[node.type]) typeGroups[node.type] = [];
        typeGroups[node.type].push(node);
      });
  
      return { processedNodes, typeGroups };
    }
  
    generateWrapperFunctions(typeGroups) {
      const wrapperFunctions = {}; // { [nodeType]: { funcName, params, outputs } }
      const wrapperFuncCodes = [];
  
      for (const type in typeGroups) {
        const funcName = this.createUniqueName(type);
        // Вычисляем объединённый набор параметров для данного типа (из inputs и widgets)
        const paramSet = new Set();
  
        typeGroups[type].forEach(node => {
          Object.values(node.inputs || {}).forEach(input => {
            if (input.name) paramSet.add(input.name);
          });
  
          Object.values(node.widgets || {}).forEach(widget => {
            if (widget.name && widget.name !== 'control_after_generate') paramSet.add(widget.name);
          });
        });
  
        const params = Array.from(paramSet);
        // params.sort();
  
        const paramList = params.join(', ');
        // Передаём все параметры в graph.node через именованные аргументы (param=param)
        const paramArgsForNode = params.map(p => `${p}=${p}`).join(', ');

        // Берём выходы из первой ноды этого типа и формируем строки для docstring
        const firstNode = typeGroups[type][0];
        const outputs = [];
        const outputDocLines = [];
  
        if (firstNode.outputs) {
          for (let i = 0; i < firstNode.outputs.length; i++) {
            outputs.push(`out_${i} = node.out(${i})`);
            const output = firstNode.outputs[i];
            if (output.type) {
              outputDocLines.push(`:return: ${output.label ?? output.name}(${output.type})`);
            } else {
              outputDocLines.push(`:return: out_${i}`);
            }
          }
        }
  
        const returnStatement = outputs.length
          ? `    return ${Array.from({ length: outputs.length }, (_, i) => `out_${i}`).join(', ')}`
          : '';
  
        const funcCode = [
          `def ${funcName}(${paramList}):`,
          `    """Wrapper function for "${type}".`,
          ...outputDocLines.map(line => `    ${line}`),
          `    """`,
          `    node = graph.node('${type}', ${paramArgsForNode})`,
          ...outputs.map(line => `    ${line}`),
          returnStatement,
          ''
        ].join('\n');
  
        wrapperFuncCodes.push(funcCode);
        wrapperFunctions[type] = { funcName, params, outputs: firstNode.outputs.map(output => output.label ?? output.name) };
      }
  
      return { wrapperFunctions, wrapperFuncCodes };
    }
  
    generate() {
      // 1. Получаем обработанные ноды и группируем их по типу
      const { processedNodes, typeGroups } = this.generateTypeGroups();
  
      // 2. Генерируем обёрнутые функции по группам нод
      const { wrapperFunctions, wrapperFuncCodes } = this.generateWrapperFunctions(typeGroups);
  
      // 3. Генерируем секции для значений по умолчанию и вызова нод,
      // при этом используем результаты предыдущих нод, если вход ссылается на их выход.
      const defaultLines = [];
      const executionLines = [];
      const outputLinks = new Map();
  
      processedNodes.forEach((node, index) => {
        const { funcName, params, outputs } = wrapperFunctions[node.type];
        const nodeVar = node.var || `${funcName}_${node.id}` || `${funcName}_${index}`;
        node.var = nodeVar;
        const argAssignments = [];
  
        params.forEach(param => {
          const defaultVar = `${nodeVar}_${param}`;
          let defaultValue = 'None';
          let found = false;
  
          // Проверяем входы: если есть ссылка на выход предыдущей ноды, используем переменную результата
          if (node.inputs) {
            Object.values(node.inputs).forEach(input => {
              if (input.name === param) {
                if (input.link && outputLinks.has(input.link)) {
                  defaultValue = outputLinks.get(input.link);
                } else if (input.link) {
                  defaultValue = `LINK_${input.type}_${input.link}`;
                }
                // found = true;
              }
            });
          }
  
          // Если значение не найдено среди входов, проверяем виджеты
          if (!found && node.widgets) {
            Object.values(node.widgets).forEach(widget => {
              if (widget.name === param && widget.name !== 'control_after_generate') {
                defaultValue = this.formatValue(widget.value);
                found = true;
              }
            });
          }
          
          if (found) {
            defaultLines.push(`${defaultVar} = ${defaultValue}`);
            argAssignments.push(`${param}=${defaultVar}`);
          } else {
            argAssignments.push(`${param}=${defaultValue}`);
          }
          
        });
  
        // Формируем вызов обёрнутой функции
        const getFuncOutputName = (node, index) => {
          let name = `${outputs[index]}_${node.id}_out${index}`;
          return this.sanitizeName(name);
        };
        const outputCount = (node.outputs && node.outputs.length) || 0;
        const outVars = outputCount
          ? Array.from({ length: outputCount }, (_, i) => getFuncOutputName(node, i))
          : [];
  
        if (node.title) {
          executionLines.push(`# ${node.title}`);
        } else {
          executionLines.push(`# ${node.type}`);
        }
  
        const callLine = outVars.length
          ? `${outVars.join(', ')} = ${funcName}(${argAssignments.join(', ')})`
          : `${funcName}(${argAssignments.join(', ')})`;
  
        executionLines.push(callLine, '');
  
        // Сохраняем имена переменных для выходов, чтобы их можно было использовать в качестве значений для входов следующих нод
        if (node.outputs) {
          //console.log('node.outputs', node.outputs);
          node.outputs.forEach((output, i) => {
            //console.log('output.link', output.link);
            if (Array.isArray(output.links)) {
                output.links.forEach(link => {
                    outputLinks.set(link, getFuncOutputName(node, i));
                    console.log(`${link} -> ${getFuncOutputName(node, i)}`);
                });
            }
          });
        }
      });
  
      const fullCode = [
        '# AUTO-GENERATED CODE',
        '### DEFAULT INPUTS SECTION ###',
        ...defaultLines,
        '',
        '### WRAPPER FUNCTIONS SECTION ###',
        ...wrapperFuncCodes,
        '### NODE EXECUTION SECTION ###',
        ...executionLines
      ].join('\n');
  
      return fullCode;
    }
  }

// Основная функция
export const copyGraphNodes_v2 = (nodes) => {
    try {
        const generator = new UnifiedCodeGenerator(nodes);
        const fullCode = generator.generate();
        
        createOutputNode(fullCode);
        navigator.clipboard.writeText(fullCode);
    } catch (error) {
        console.error('Code generation failed:', error);
    }
};

function createOutputNode(code) {
    const newNode = app.graph.add(LiteGraph.createNode(
        NODE_TYPES.PY_EXEC_OUTPUT,
        NODE_TYPES.PY_EXEC_OUTPUT, {
            pos: [...app.canvas.canvas_mouse]
        }
    ));
    
    newNode.properties.pycode = code;
    newNode.properties.inputs = '';
    newNode.properties.outputs = '';
    newNode.properties.widgets = '[]';
    NodeHelper.createWidgets(null, newNode);
}
