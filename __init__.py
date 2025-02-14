"""
@author: SeniorPioner
@title: PyExec
@nickname: PyExec
@description: Comfyui runtime python code execution
"""

from .PyExec import NODE_CLASS_MAPPINGS as PyExec_NODE_CLASS_MAPPINGS
from .DynamicGroupNode import NODE_CLASS_MAPPINGS as DynamicGroupNode_NODE_CLASS_MAPPINGS

NODE_CLASS_MAPPINGS = {**PyExec_NODE_CLASS_MAPPINGS, **DynamicGroupNode_NODE_CLASS_MAPPINGS}
WEB_DIRECTORY = 'web'

__all__ = ['NODE_CLASS_MAPPINGS', 'WEB_DIRECTORY']