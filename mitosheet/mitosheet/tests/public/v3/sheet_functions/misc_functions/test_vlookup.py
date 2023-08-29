#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Saga Inc.
# Distributed under the terms of the GPL License.
"""
Contains tests for the TYPE function.
"""

import pytest
import pandas as pd
import numpy as np
import datetime

from mitosheet.public.v3.sheet_functions.misc_functions import VLOOKUP

TYPE_VALID_TESTS = [
    # Basic tests
    (
        [
            pd.Series([3, 1, 2]),
            pd.DataFrame({'D': [1, 2, 3], 'E': ['d', 'e', 'f'], 'F': ['h', 'i', 'j']}),
            2
        ],
        pd.Series(['f', 'd', 'e'])
    ),
    (
        [
            pd.Series(['a', 'b', 'c']),
            pd.DataFrame({0: ['c', 'a', 'b'], 1: ['d', 'e', 'f'], 2: ['h', 'i', 'j']}),
            3
        ],
        pd.Series(['i', 'j', 'h'])
    ),
    # Tests for when the lookup value is a primitive
    (
        [
            'a',
            pd.DataFrame({0: ['c', 'a', 'b'], 1: ['d', 'e', 'f'], 2: ['h', 'i', 'j']}),
            2
        ],
        'e'
    ),
    # Tests for when the index argument is a list
    (
        [
            pd.Series(['a', 'b', 'c']),
            pd.DataFrame({0: ['c', 'a', 'b'], 1: ['d', 'e', 'f'], 2: ['h', 'i', 'j']}),
            [2,3]
        ],
        pd.DataFrame({1: ['e', 'f', 'd'], 2: ['i', 'j', 'h']})
    ),
    (
        [
            pd.Series(['a', 'b', 'c']),
            pd.DataFrame({0: ['c', 'a', 'b'], 1: [pd.Timestamp('2017-01-04'), pd.Timestamp('2011-02-12'), pd.Timestamp('2018-04-02')], 2: ['h', 'i', 'j']}),
            2
        ],
        pd.Series([pd.Timestamp('2011-02-12'), pd.Timestamp('2018-04-02'), pd.Timestamp('2017-01-04')])
    ),
]

@pytest.mark.parametrize("_argv, expected", TYPE_VALID_TESTS)
def test_vlookup_direct(_argv, expected):
    result = VLOOKUP(*_argv)
    print(f'expected: {expected}')
    print(f'result: {result}')
    if isinstance(result, pd.Series):
        pd.testing.assert_series_equal(result,expected, check_names=False, check_series_type=False)
    elif isinstance(result, pd.DataFrame):
        pd.testing.assert_frame_equal(result,expected, check_column_type=False)
    else: 
        assert result == expected