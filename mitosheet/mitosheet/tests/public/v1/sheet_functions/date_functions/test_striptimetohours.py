#!/usr/bin/env python
# coding: utf-8

# Copyright (c) Saga Inc.
# Distributed under the terms of the GPL License.
"""
Contains tests for the STRIPTIMETOHOURS function.
"""

import pytest
import pandas as pd

from mitosheet.public.v1.sheet_functions.date_functions import STRIPTIMETOHOURS
from mitosheet.tests.test_utils import create_mito_wrapper_with_data

STRIP_TO_HOURS_TESTS = [
    (pd.Series(data=[pd.to_datetime('2000-1-2 12:45:23')], dtype='datetime64[ns]'), (pd.Series(data=[pd.to_datetime('2000-1-2 12:00:00')], dtype='datetime64[ns]'))),
    (pd.to_datetime('2000-1-2 00:00:00'), (pd.Series(data=[pd.to_datetime('2000-01-02 00:00:00')], dtype='datetime64[ns]'))),
    ('2000-1-2 12:02:15', (pd.Series(data=[pd.to_datetime('2000-01-02 12:00:00')], dtype='datetime64[ns]'))),
    ('1/2/2000', (pd.Series(data=[pd.to_datetime('2000-01-02 00:00:00')], dtype='datetime64[ns]'))),
]
@pytest.mark.parametrize("date, result_date", STRIP_TO_HOURS_TESTS)
def test_strip_to_hours_works_on_inputs(date, result_date):
    assert STRIPTIMETOHOURS(date).tolist() == result_date.tolist()

def test_strip_to_hours_works_in_sheet():
    mito = create_mito_wrapper_with_data(['2000-1-2 12:45:23'])
    mito.set_formula('=STRIPTIMETOHOURS(A)', 0, 'B', add_column=True)
    assert mito.get_value(0, 'B', 1) == pd.Series(data=[pd.to_datetime('2000-1-2 12:00:00')], dtype='datetime64[ns]').tolist()[0]