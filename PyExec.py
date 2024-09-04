import io
import contextlib
from comfy_execution.graph_utils import GraphBuilder

CATEGORY = "SP-Nodes"

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False

class GlobalStorage:
    pass

ANY_TYPE = AnyType("*")
ARGS_COUNT = 20
GLOBAL_STORAGE = GlobalStorage()

def pyexec(py, **kwargs):
    graph = GraphBuilder()

    try:
        output = io.StringIO()
        local_vars = {
            'gs': GLOBAL_STORAGE,
            'graph': graph,
            **kwargs,
            **{f'r{i}': None for i in range(1, ARGS_COUNT + 1)}
        }
        
        exec_globals = globals().copy()
        exec_globals.update(local_vars)
    
        with contextlib.redirect_stdout(output):
            exec(py, exec_globals, exec_globals)
        
        def to_list(value):
            return value if isinstance(value, list) else [value]
        
        # result = tuple(to_list(exec_globals.get(f'r{i}', None)) for i in range(1, ARGS_COUNT + 1))
        result = tuple(exec_globals.get(f'r{i}', None) for i in range(1, ARGS_COUNT + 1))
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
        return tuple([[err]] * ARGS_COUNT)
        
class PyExec:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "py": ("STRING", {"default": 'r1=a1\nr2=a2+1\nr3=prompt\nr4=id\nr5=workflow\nr6=dynprompt\n', "multiline": True}),
                "args_count": ("INT", {"default": 0, "min": 0, "max": ARGS_COUNT, "step": 1}),
            },
            "hidden": {
				"prompt": "PROMPT",
				"id": "UNIQUE_ID",
				"workflow": "EXTRA_PNGINFO",
				"dynprompt": "DYNPROMPT",
			}
        }

    RETURN_TYPES = tuple([ANY_TYPE] * ARGS_COUNT)
    RETURN_NAMES = tuple(f'r{i}' for i in range(1, ARGS_COUNT + 1))
    OUTPUT_IS_LIST = tuple([False] * ARGS_COUNT)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(s, py, **kwargs):
        return pyexec(py, **kwargs)

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

NODE_CLASS_MAPPINGS = {
    "PyExec": PyExec, 
    "PyExec_Output": PyExec_Output, 
    "PyExec_OutputIsList": PyExec_OutputIsList, 
}