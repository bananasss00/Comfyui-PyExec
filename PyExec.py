import io
import contextlib
import json
import types
from comfy_execution.graph_utils import GraphBuilder
from server import PromptServer
from aiohttp import web
from asyncio import sleep, run

# refactor node with changes from https://github.com/AlekPet/ComfyUI_Custom_Nodes_AlekPet/tree/master/IDENode

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

@PromptServer.instance.routes.post("/pyexec/check_js_complete")
async def check_js_complete(request):
    json_data = await request.json()
    unique_id = json_data.get("unique_id", None)
    result_code = json_data.get("result_code", None)

    if (
        unique_id is not None
        and unique_id in IDEs_DICT
        and result_code
        and result_code is not None
    ):
        IDEs_DICT[unique_id].js_result = result_code
        IDEs_DICT[unique_id].js_complete = True
        return web.json_response({"status": "Ok"})

    return web.json_response({"status": "Error"})


async def wait_js_complete(unique_id, time_out=40):
    for _ in range(time_out):
        if (
            hasattr(IDEs_DICT[unique_id], "js_complete")
            and IDEs_DICT[unique_id].js_complete == True
            and IDEs_DICT[unique_id].js_result is not None
        ):
            IDEs_DICT[unique_id].js_complete = False
            return True

        await sleep(0.1)

    return False

class GlobalStorage:
    pass

ANY_TYPE = AnyType("*")
GLOBAL_STORAGE = GlobalStorage()
        
class PyExec:
    def __init__(self):
        self.js_complete = False
        self.js_result = None

    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": {},
            "required": {
                "language": (
                    (["python", "javascript"]),
                    {"default": "python"},
                ),
                "pycode": (
                    "PYCODE",
                    {
                        "default": """# !!! Attention, do not insert unverified code !!!
# ---- Example code ----
# Globals inputs variables: var1, var2, var3, user variables ...
from time import strftime
def runCode():
    nowDataTime = strftime("%Y-%m-%d %H:%M:%S")
    return f"Hello ComfyUI with us today {nowDataTime}!"
result = runCode()"""
                    },
                ),
            },
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
    # OUTPUT_IS_LIST = tuple([False] * ARGS_COUNT)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(self, language, pycode, **kwargs):
        return self.pyexec(language, pycode, **kwargs)

    def pyexec(self, language, pycode, **kwargs):
        unique_id = kwargs['id']

        if unique_id not in IDEs_DICT:
            IDEs_DICT[unique_id] = self

        graph = GraphBuilder()

        try:
            output = io.StringIO()

            outputs = {}
            for node in kwargs['workflow']['workflow']['nodes']:
                if node['id'] == int(unique_id):
                    outputs_valid = [ouput for ouput in node.get('outputs', []) if ouput.get('name','') != '' and ouput.get('type','') != '']
                    outputs = {ouput['name']: None for ouput in outputs_valid}
                    self.RETURN_TYPES = ByPassTypeTuple(out["type"] for out in outputs_valid)
                    self.RETURN_NAMES = tuple(name for name in outputs.keys())

            my_namespace = types.SimpleNamespace()
            my_namespace.__dict__.update(outputs)            
            my_namespace.__dict__.update({prop: kwargs[prop] for prop in kwargs})
            my_namespace.__dict__.setdefault("result", "The result variable is not assigned")
            
            result = tuple()
            if language == "python":
                my_namespace.__dict__.update({
                    'gs': GLOBAL_STORAGE,
                    'graph': graph,
                })
                
                with contextlib.redirect_stdout(output):
                    exec(pycode, my_namespace.__dict__)
                
                new_dict = {key: my_namespace.__dict__[key] for key in my_namespace.__dict__ if key not in ['__builtins__', *kwargs.keys()] and not callable(my_namespace.__dict__[key])}
                result = (*new_dict.values(),)

                # print(f'result: {result}')
                captured_output = output.getvalue()
                print(f'PyExec: {captured_output}')
            else:
                IDEs_DICT[unique_id].js_complete = False
                IDEs_DICT[unique_id].js_result = None

                new_dict = {key: my_namespace.__dict__[key] for key in my_namespace.__dict__ if key not in ['__builtins__', *kwargs.keys()] and not callable(my_namespace.__dict__[key])}
                
                PromptServer.instance.send_sync(
                    "pyexec_js_result",
                    {"unique_id": unique_id, "vars": json.dumps(new_dict)},
                )
                if not run(wait_js_complete(unique_id)):
                    print(f"PyExec_{unique_id}: Failed to get data!")
                else:
                    print(f"PyExec_{unique_id}: Data received successful!")

                result = (*IDEs_DICT[unique_id].js_result,)

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

class PyExec_Output(PyExec):
    OUTPUT_NODE = True

class PyExec_OutputIsList:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "value": (ANY_TYPE,),
            },
        }

    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ('list_value',)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(s, value):
        return value,

class PyExec_OutputIsValue:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "list_value": (ANY_TYPE,),
            },
        }

    RETURN_TYPES = (ANY_TYPE,)
    RETURN_NAMES = ('value',)
    INPUT_IS_LIST = True
    OUTPUT_IS_LIST = (False,)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(s, list_value):
        return list_value,

NODE_CLASS_MAPPINGS = {
    "PyExec": PyExec, 
    "PyExec_Output": PyExec_Output, 
    "PyExec_OutputIsList": PyExec_OutputIsList, 
    "PyExec_OutputIsValue": PyExec_OutputIsValue, 
}