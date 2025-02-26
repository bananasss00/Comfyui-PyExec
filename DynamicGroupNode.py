import hashlib
import io
import contextlib
import json
import logging
import sys, importlib.util
import os
import types
from comfy_execution.graph_utils import GraphBuilder
from server import PromptServer
from aiohttp import web
from asyncio import sleep, run

CATEGORY = "SP-Nodes"

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False
    
# - Thank you very much for the class -> Trung0246 -
# - https://github.com/Trung0246/ComfyUI-0246/blob/main/utils.py#L51
class TautologyStr(str):
	def __ne__(self, other):
		return False


class ByPassTypeTuple(tuple):
	def __getitem__(self, index):
		if index > 0:
			index = 0
		item = super().__getitem__(index)
		if isinstance(item, str):
			return TautologyStr(item)
		return item
# ---------------------------

class GlobalStorage:
    pass

ANY_TYPE = AnyType("*")
GLOBAL_STORAGE = GlobalStorage()
PYCODE_MD5 = {}

@PromptServer.instance.routes.get("/pyexec/pycode_md5/{id}/{md5}")
async def pycode_md5(request):
    id = request.match_info["id"]
    md5 = request.match_info["md5"]
    PYCODE_MD5[id] = md5
    return web.Response(status=201)
    
def import_module(path: str, module_name: str = None, force: bool = False) -> types.ModuleType:
    def reload_module(module_name, module_path):
        if module_name in sys.modules:
            del sys.modules[module_name]

        spec = importlib.util.spec_from_file_location(module_name, module_path)
        module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = module
        spec.loader.exec_module(module)

        return module

    if module_name is None:
        module_name = os.path.splitext(os.path.basename(path))[0]
    
    if module_name in sys.modules and not force:
        return sys.modules[module_name]
    
    parent_path = os.path.dirname(path)
    if parent_path not in sys.path:
        sys.path.append(parent_path)

    if os.path.isdir(path) and os.path.exists(os.path.join(path, '__init__.py')):
        module_path = os.path.join(path, '__init__.py')
    else:
        module_path = path

    module = reload_module(module_name, module_path)
    return module

class DynamicGroupNode:
    OPTIONALS = {}

    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": DynamicGroupNode.OPTIONALS, 
            "required": {},
            "hidden": {
				"prompt": "PROMPT",
				"id": "UNIQUE_ID",
				"workflow": "EXTRA_PNGINFO",
				"dynprompt": "DYNPROMPT",
			}
        }

    RETURN_TYPES = ByPassTypeTuple((ANY_TYPE,))
    RETURN_NAMES =  ("result",)
    INPUT_IS_LIST = False
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(self, **kwargs):
        unique_id = kwargs['id']
        graph = GraphBuilder()

        try:
            output = io.StringIO()

            pycode = ''

            outputs = {}
            for node in kwargs['workflow']['workflow']['nodes']:
                if node['id'] == int(unique_id):
                    pycode =node['properties']['pycode']

                    outputs_valid = [ouput for ouput in node.get('outputs', []) if ouput.get('name','') != '' and ouput.get('type','') != '']
                    outputs = {ouput['name']: None for ouput in outputs_valid}
                    self.RETURN_TYPES = ByPassTypeTuple(out["type"] for out in outputs_valid)
                    self.RETURN_NAMES = tuple(name for name in outputs.keys())
            widgets = {}
            
            for k, v in kwargs['prompt'].items():
                if k == unique_id:
                    widgets = {name: value for name, value in v['inputs'].items() if name != 'pycode'}

            # TODO: rawLink, lazy inputs support
            # DynamicGroupNode.OPTIONALS = {'dbg': ('IMAGE', {'rawLink': True})}
            my_namespace = types.SimpleNamespace()     
            my_namespace.__dict__.update(outputs)            
            my_namespace.__dict__.update(widgets)
            my_namespace.__dict__.update({prop: kwargs[prop] for prop in kwargs})
            my_namespace.__dict__.setdefault("result", "The result variable is not assigned")
            
            result = tuple()
            my_namespace.__dict__.update({
                'gs': GLOBAL_STORAGE,
                'graph': graph,
                'import_module': import_module
            })
            
            # print(pycode)
            with contextlib.redirect_stdout(output):
                exec(pycode, my_namespace.__dict__)
            
            new_dict = {key: my_namespace.__dict__[key] for key in my_namespace.__dict__ if key not in ['__builtins__', *kwargs.keys()] and not callable(my_namespace.__dict__[key])}
            result = (*new_dict.values(),)

            # print(f'result: {result}')
            captured_output = output.getvalue()
            # print(f'PyExec[NODE_ID={unique_id}]: {captured_output}')

            return {
                "result": result,
                "expand": graph.finalize(),
            }
        
        except Exception as e:
            import traceback
            stacktrace = traceback.format_exc()
            err = f"Exception[NODE_ID={unique_id}]: {e}\n{stacktrace}"
            print(err)
            return tuple([[err]] * len(self.RETURN_TYPES))

    @classmethod
    def IS_CHANGED(s, id, **kwargs):
        return PYCODE_MD5.get(id, None)

    @classmethod
    def calculate_md5(s, string):
        md5_hash = hashlib.md5()
        md5_hash.update(string.encode('utf-8'))
        return md5_hash.hexdigest()

class DynamicGroupNode_Output(DynamicGroupNode):
    OUTPUT_NODE = True

NODE_CLASS_MAPPINGS = {
    "DynamicGroupNode": DynamicGroupNode, 
    "DynamicGroupNode_Output": DynamicGroupNode_Output, 
}