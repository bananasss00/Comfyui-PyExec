import io
import contextlib
import json
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

IDEs_DICT = {}

class GlobalStorage:
    pass

ANY_TYPE = AnyType("*")
GLOBAL_STORAGE = GlobalStorage()
        
class DynamicGroupNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": {},
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

        if unique_id not in IDEs_DICT:
            IDEs_DICT[unique_id] = self

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
                    
            my_namespace = types.SimpleNamespace()     
            my_namespace.__dict__.update(outputs)            
            my_namespace.__dict__.update(widgets)
            my_namespace.__dict__.update({prop: kwargs[prop] for prop in kwargs})
            my_namespace.__dict__.setdefault("result", "The result variable is not assigned")
            
            result = tuple()
            my_namespace.__dict__.update({
                'gs': GLOBAL_STORAGE,
                'graph': graph,
            })
            
            print(pycode)
            with contextlib.redirect_stdout(output):
                exec(pycode, my_namespace.__dict__)
            
            new_dict = {key: my_namespace.__dict__[key] for key in my_namespace.__dict__ if key not in ['__builtins__', *kwargs.keys()] and not callable(my_namespace.__dict__[key])}
            result = (*new_dict.values(),)

            # print(f'result: {result}')
            captured_output = output.getvalue()
            print(f'PyExec: {captured_output}')

            return {
                "result": result,
                "expand": graph.finalize(),
            }
        
        except Exception as e:
            import traceback
            stacktrace = traceback.format_exc()
            err = f"Exception: {e}\n{stacktrace}"
            print(err)
            return tuple([[err]] * len(self.RETURN_TYPES))

NODE_CLASS_MAPPINGS = {
    "DynamicGroupNode": DynamicGroupNode, 
}