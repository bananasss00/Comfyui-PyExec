import io
import contextlib
from comfy_execution.graph_utils import GraphBuilder

CATEGORY = "SP-Nodes"

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False
    
ANY_TYPE = AnyType("*")

class PyExec:
    Args = 20

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "py": ("STRING", {"default": 'r1=a1\nr2=a2+1\nr3=prompt\nr4=id\nr5=workflow\nr6=dynprompt\n', "multiline": True}),
                "argscount": ("INT", {"default": 0, "min": 0, "max": PyExec.Args, "step": 1}),
            },
            # "optional": {
            #     "a1": (ANY_TYPE,),
            #     "a2": (ANY_TYPE,),
            #     "a3": (ANY_TYPE,),
            #     "a4": (ANY_TYPE,),
            #     "a5": (ANY_TYPE,),
            # },
            "hidden": {
				"prompt": "PROMPT",
				"id": "UNIQUE_ID",
				"workflow": "EXTRA_PNGINFO",
				"dynprompt": "DYNPROMPT",
			}
        }

    # RETURN_TYPES = tuple(['STRING'])
    # RETURN_NAMES = tuple(['STRING'])
    # OUTPUT_IS_LIST = tuple([True])
    RETURN_TYPES = tuple([ANY_TYPE] * Args)
    RETURN_NAMES = tuple(f'r{i}' for i in range(1, Args + 1))
    OUTPUT_IS_LIST = tuple([True] * Args)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = True

    def doit(s, py, **kwargs):
        graph = GraphBuilder()

        try:
            output = io.StringIO()
            local_vars = {
                'graph': graph,
                **kwargs,
                **{f'r{i}': None for i in range(1, PyExec.Args + 1)}
            }
            
            exec_globals = globals().copy()
            exec_globals.update(local_vars)
        
            with contextlib.redirect_stdout(output):
                exec(py, exec_globals, exec_globals)
            
            def to_list(value):
                return value if isinstance(value, list) else [value]
            
            result = tuple(to_list(exec_globals.get(f'r{i}', None)) for i in range(1, PyExec.Args + 1))
            print(f'result: {result}')
            captured_output = output.getvalue()
            print(f'PyExec: {captured_output}')

            return {
                "result": result,
                "expand": graph.finalize(),
            }
        
        except Exception as e:
            import traceback
            stacktrace = traceback.format_exc()
            err = f"Произошла ошибка: {e}]\n{stacktrace}"
            print(err)
            return tuple([[err]] * PyExec.Args)
        
NODE_CLASS_MAPPINGS = {
    "PyExec": PyExec, 
}