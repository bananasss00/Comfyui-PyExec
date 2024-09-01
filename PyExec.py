import io
import contextlib
from comfy_execution.graph_utils import GraphBuilder

CATEGORY = "SP-Nodes"

class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False
    
ANY_TYPE = AnyType("*")

class PyExec:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "py": ("STRING", {"default": '', "multiline": True}),
            },
            "optional": {
                "a1": (ANY_TYPE,),
                "a2": (ANY_TYPE,),
                "a3": (ANY_TYPE,),
                "a4": (ANY_TYPE,),
                "a5": (ANY_TYPE,),
            },
        }

    RETURN_TYPES = (ANY_TYPE, ANY_TYPE, ANY_TYPE, ANY_TYPE, ANY_TYPE)
    RETURN_NAMES = ('r1', 'r2', 'r3', 'r4', 'r5')
    OUTPUT_IS_LIST = (True,True,True,True,True)
    FUNCTION = "doit"
    CATEGORY = CATEGORY
    OUTPUT_NODE = False

    def doit(s, py, a1=None, a2=None, a3=None, a4=None, a5=None):
        graph = GraphBuilder()

        try:
            output = io.StringIO()
            local_vars = {
                'graph': graph,
                'a1': a1,
                'a2': a2,
                'a3': a3,
                'a4': a4,
                'a5': a5,
                'r1': None,
                'r2': None,
                'r3': None,
                'r4': None,
                'r5': None
            }
            
            # Создаем объединение глобальных и локальных переменных
            exec_globals = globals().copy()
            exec_globals.update(local_vars)
        
            with contextlib.redirect_stdout(output):
                exec(py, exec_globals, exec_globals)
            
            def to_list(value):
                return value if isinstance(value, list) else [value]
            
            result = (
                to_list(exec_globals.get('r1', None)),
                to_list(exec_globals.get('r2', None)),
                to_list(exec_globals.get('r3', None)),
                to_list(exec_globals.get('r4', None)),
                to_list(exec_globals.get('r5', None))
            )

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
            return ([err],) * 5
        
NODE_CLASS_MAPPINGS = {
    "PyExec": PyExec, 
}