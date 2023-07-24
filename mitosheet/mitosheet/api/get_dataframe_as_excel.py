#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Saga Inc.
# Distributed under the terms of the GPL License.
import base64
import io
from typing import Any, Dict

import pandas as pd
from mitosheet.excel_utils import get_df_name_as_valid_sheet_name
from mitosheet.public.v3 import add_formatting_to_excel_sheet
from mitosheet.types import StepsManagerType
from mitosheet.user import is_pro


def get_dataframe_as_excel(params: Dict[str, Any], steps_manager: StepsManagerType) -> str:
    """
    Sends a dataframe as a excel string.
    """
    sheet_indexes = params['sheet_indexes']
    is_pro_user = is_pro()

    # We write to a buffer so that we don't have to save the file
    # to the file system for no reason
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        workbook = writer.book
        for sheet_index in sheet_indexes:
            # Get the dataframe and sheet name
            df = steps_manager.dfs[sheet_index]
            df_name = steps_manager.curr_step.df_names[sheet_index]
            sheet_name = get_df_name_as_valid_sheet_name(df_name)

            # Write the dataframe to the sheet
            df.to_excel(writer, sheet_name, index=False)

            # Add formatting to the sheet for pro users
            format = steps_manager.curr_step.df_formats[sheet_index]
            if is_pro_user:
                add_formatting_to_excel_sheet({ workbook, sheet_name, format })
    
    # Go back to the start of the buffer
    buffer.seek(0)
    
    # First, we take the buffer, and base64 encode it in bytes,
    # and then we covert this to ASCII. On the front-end, we 
    # turn it back into base64, then back to bytes, before 
    # creating a Blob out of it
    return base64.b64encode(buffer.read()).decode('ascii')
