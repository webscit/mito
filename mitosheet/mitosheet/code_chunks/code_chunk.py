#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Saga Inc.
# Distributed under the terms of the GPL License.


from typing import TYPE_CHECKING, Any, List, Optional, Tuple

from mitosheet.types import ParamSubtype, ParamType, ParamValue

if TYPE_CHECKING:
    from mitosheet.state import State
else:
    State = Any

class CodeChunk:
    """
    A CodeChunk is the a abstract base class that can be inhereited from
    to create a code generating object. For example, an AddColumnCodeChunk
    with the correct parameters and states will generate code that adds
    a column with a specific column header to a specific dataframe.

    When a step is transpiled, it generates a list of code chunks. In turn,
    we can optimize these code chunks to allow us to write the most minimal
    amount of code. 
    """

    def __init__(self, 
        prev_state: State,
    ):
        self.prev_state = prev_state

    def __repr__(self) -> str:
        members = [
            (attr, getattr(self, attr)) for attr in dir(self) if not callable(getattr(self, attr)) and not attr.startswith("__")
            and ('sheet_index' in attr or 'file_name' in attr)
        ]
        return f"{self.__class__.__name__}({members})"

    def get_display_name(self) -> str:
        """Returns a short name to display for this CodeChunk"""
        raise NotImplementedError('Implement in subclass')
    
    def get_description_comment(self) -> str:
        """Returns a detailed comment explaing what happened in this CodeChunk"""
        raise NotImplementedError('Implement in subclass')

    def get_code(self) -> Tuple[List[str], List[str]]:
        """
        Returns a Tuple of lists of code strings that this code chunk executes. 
        The first list is the code used to perfrom the operation. The second list 
        is the imports required for the code. ie: import pandas as pd
        """
        raise NotImplementedError('Implement in subclass')

    # TODO: we could add a function that returns a list of params and execution
    # data that you're allowed to reference, and then check this when you create
    # the step, for strong typing!

    def params_match(self, other_code_chunk: "CodeChunk", param_keys: List[str]) -> bool:
        """
        Given a different code chunk, and a list of keys to check, returns True if
        all the given keys match in the params. A useful utility for checking if 
        CodeChunks are compatible for combination.
        """
        for key in param_keys:
            if self.__dict__[key] != other_code_chunk.__dict__[key]:
                return False
        return True

    def get_created_sheet_indexes(self) -> Optional[List[int]]:
        """
        Dataframe deletes allow us to optimize a lot of code, we allow steps to
        optionally say that they only create some specific list of sheet_indexes.

        If this function returns a sheet index, and later dataframe delete steps
        delete this sheet index, then we will optimize out this step as well as
        the deleting of the dataframe.

        NOTE: if this funciton returns None, it is this CodeChunk saying that
        it cannot do any optimization with dataframe delete - which we do by
        default.
        """
        return None
    
    def get_edited_sheet_indexes(self) -> Optional[List[int]]:
        """
        Dataframe deletes allow us to optimize a lot of code, we allow steps to
        optionally say that they only edit some specific list of sheet_indexes.

        This allows us to easily optimize out these steps if the dataframe they 
        are editing is then deleted.

        NOTE: if this funciton returns None, it is this CodeChunk saying that
        it cannot do any optimization with dataframe delete - which we do by
        default.
        """
        return None
    
    def get_source_sheet_indexes(self) -> Optional[List[int]]:
        """
        If you return some created sheet indexes, then you can also return 
        the source sheet indexes that you created this new sheet from. If 
        you return None from this function, it means that you did not have 
        any source dataframes.
        """
        return None

    
    def combine_right(self, other_code_chunk: "CodeChunk") -> Optional["CodeChunk"]:
        """
        Given a list of CodeChunks [A, B], combine right called on A with
        B as a parameter will check if A and B can be combined into a new
        CodeChunk. 

        If they cannot be combined, None will be returned. If they can be
        combined, the new combined CodeChunk will be returned, and thus
        [A, B] goes to [A.combine_right(B)]
        """
        return None
    
    def combine_left(self, other_code_chunk: "CodeChunk") -> Optional["CodeChunk"]:
        """Given a list of CodeChunks [A, B], combine right called on B with
        A as a parameter will check if A and B can be combined into a new
        CodeChunk. 

        If they cannot be combined, None will be returned. If they can be
        combined, the new combined CodeChunk will be returned, and thus
        [A, B] goes to [B.combine_right(A)]

        NOTE: combine_lefts are only done after the combine_rights. You might want
        to do one vs. the other depending on how natural it is to express. For example,
        because deleting a dataframe delete can remove a ton of other steps, expressing
        it as a combine_left is much more natural as it results in this optimization
        code all living in one location.
        """
        return None
    
    def get_parameterizable_params(self) -> List[Tuple[ParamValue, ParamType, ParamSubtype]]:
        """
        Returns a list of parameters that can be parameterized. This is used
        for the parameterization UI.

        The tuple is (param_name, param_type, param_subtype).
        """
        return []
    
    def can_be_reordered_with(self, code_chunk: "CodeChunk") -> bool:
        """
        Returns true if the passed code chunk can be moved from
        before to after (or after to before) with this code chunk. 
        """

        edited_sheet_indexes = self.get_edited_sheet_indexes()
        source_sheet_indexes = self.get_source_sheet_indexes()
        other_edited_indexes = code_chunk.get_edited_sheet_indexes()

        # First, don't reorder if they touch the same sheet
        if edited_sheet_indexes is not None and other_edited_indexes is not None and set(edited_sheet_indexes) == set(other_edited_indexes):
            print("NO< EDITED", edited_sheet_indexes, other_edited_indexes)
            return False
        
        # Second, don't reorder if the other code chunk edits where this code chunk pulls from
        if source_sheet_indexes is not None and other_edited_indexes is not None and any(index in source_sheet_indexes for index in other_edited_indexes):
            print("NO< SOURCE OVERLAP")
            return False

        return True