#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Saga Inc.
# Distributed under the terms of the GPL License.

from io import StringIO
from os.path import basename, normpath
import re
from typing import Any, Collection, Dict, List, Optional, Tuple

import pandas as pd

from mitosheet.code_chunks.step_performers.import_steps.simple_import_code_chunk import \
    generate_read_csv_code
from mitosheet.preprocessing.preprocess_step_performer import \
    PreprocessStepPerformer
from mitosheet.telemetry.telemetry_utils import log
from mitosheet.transpiler.transpile_utils import get_column_header_as_transpiled_code, get_column_header_list_as_transpiled_code, get_str_param_name
from mitosheet.types import ColumnDefinintion, ColumnDefinitionConditionalFormats, ConditionalFormat, DataframeFormat, StepsManagerType
from mitosheet.utils import get_valid_dataframe_name

def is_valid_hex_color(color: str) -> bool:

    if not color.startswith('#'):
        return False
        
    match = re.search(r'^#(?:[0-9a-fA-F]{3}){1,2}$', color)
    return match is not None
               

class SetColumnDefininitionsPreprocessStepPerformer(PreprocessStepPerformer):
    """
    This preprocessing step is responsible for converting
    all of the args to dataframes.

    If it fails to convert any of the arguments to a dataframe,
    then it will throw an error.
    """

    @classmethod
    def preprocess_step_version(cls) -> int:
        return 1

    @classmethod
    def preprocess_step_type(cls) -> str:
        return 'set_column_definitions'

    @classmethod
    def execute(cls, args: Collection[Any], kwargs: Dict[str, Any]) -> Tuple[List[Any], Optional[List[str]], Optional[Dict[str, Any]]]:

        column_definitions: List[ColumnDefinintion] = kwargs['column_definitions'] if 'column_definitions' in kwargs else None

        if column_definitions is None:
            # If no column_definitions are provided, end early
            return args, None, {}

        df_formats = []

        for sheetIndex in range(len(column_definitions)):

            df_format: DataframeFormat = {
                'columns': {},
                'headers': {},
                'rows': {'even': {}, 'odd': {}},
                'border': {},
                'conditional_formats': []
            }

            conditional_formats = []
            for column_defintion in column_definitions:
                conditional_formats_list: List[ColumnDefinitionConditionalFormats] = column_defintion['conditional_formats']
                for conditional_format in conditional_formats_list:

                    font_color = conditional_format.get('font_color', None)
                    background_color = conditional_format.get('background_color', None)

                    if font_color is None and background_color is None:
                        raise ValueError(f"column_definititon has invalid conditional_format rules. It must set the font_color, background_color, or both.")
                    
                    invalid_hex_color_error_message = "The {variable} {color} set in column_definititon is not a valid hex color. It should start with '#' and be followed by the letters from a-f, A-F and/or digits from 0-9. The length of the hexadecimal color code should be either 6 or 3, excluding '#' symbol"
                    if font_color and not is_valid_hex_color(font_color):
                        raise ValueError(invalid_hex_color_error_message.format(variable="font_color", color=font_color))

                    # Validate a string is a hex value for a color
                    if background_color and not is_valid_hex_color(background_color):
                        raise ValueError(invalid_hex_color_error_message.format(variable="background_color", color=background_color))

                    new_conditional_format: ConditionalFormat = {
                        'format_uuid': 'preset_conditional_format',
                        'columnIDs': column_defintion['columns'],
                        'filters': conditional_format['filters'],
                        'invalidFilterColumnIDs': [],
                        'color': font_color,
                        'backgroundColor': conditional_format['background_color']
                    }

                    conditional_formats.append(new_conditional_format)

            df_format['conditional_formats'] = conditional_formats
            df_formats.append(df_format)

        return args, None, {
            'df_formats': df_formats,
        }

    @classmethod
    def transpile(cls, steps_manager: StepsManagerType, execution_data: Optional[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
        """
        We don't transpile anything here because we let the transpile funciton handle dataframe formatting separetly
        """     
        return [], []