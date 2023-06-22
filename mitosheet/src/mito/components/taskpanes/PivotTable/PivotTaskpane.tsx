// Copyright (c) Mito

import React from 'react';
import DefaultTaskpane from '../DefaultTaskpane/DefaultTaskpane';
import PivotTableKeySelection from './PivotTableKeySelection';
import PivotTableValueSelection from './PivotTableValueSelection';
import { MitoAPI } from '../../../api/api';
import { getPivotFrontendParamsFromBackendParams, getPivotBackendParamsFromFrontendParams, getDefaultPivotParams } from './pivotUtils';
import { AnalysisData, BackendPivotParams, ColumnIDsMap, SheetData, StepType, UIState } from '../../../types';
import DefaultTaskpaneHeader from '../DefaultTaskpane/DefaultTaskpaneHeader';
import DefaultTaskpaneBody from '../DefaultTaskpane/DefaultTaskpaneBody';
import DefaultEmptyTaskpane from '../DefaultTaskpane/DefaultEmptyTaskpane';
import DataframeSelect from '../../elements/DataframeSelect';
import useLiveUpdatingParams from '../../../hooks/useLiveUpdatingParams';
import PivotTableFilterSection from './PivotTableFilterSection';


export type PivotTaskpaneProps = {
    dfNames: string[],
    sheetDataArray: SheetData[],
    columnIDsMapArray: ColumnIDsMap[],
    sourceSheetIndex: number,

    /* 
        These props are only defined if we are editing a pivot table
        that already exists, and these are what we then default it to
    */
    existingPivotParams?: BackendPivotParams;
    destinationSheetIndex?: number;

    setUIState: React.Dispatch<React.SetStateAction<UIState>>;
    mitoAPI: MitoAPI;
    analysisData: AnalysisData,
};


const PivotTaskpane = (props: PivotTaskpaneProps): JSX.Element => {

    const {params, setParams, error} = useLiveUpdatingParams(
        () => getDefaultPivotParams(props.sheetDataArray, props.sourceSheetIndex, props.existingPivotParams),
        StepType.Pivot,
        props.mitoAPI, props.analysisData, 0, 
        {
            getBackendFromFrontend: getPivotBackendParamsFromFrontendParams,
            getFrontendFromBackend: getPivotFrontendParamsFromBackendParams
        },
        {
            // If we have a destination sheet index, we make sure to not overwrite the pivot
            // that is there by default
            doNotSendDefaultParams: props.destinationSheetIndex !== undefined,
        },
        props.sheetDataArray
    )
    
    if (params === undefined) {
        return <DefaultEmptyTaskpane setUIState={props.setUIState}/>
    }

    const sheetData: SheetData | undefined = props.sheetDataArray[params.sourceSheetIndex];
    
    return (
        <DefaultTaskpane>
            <DefaultTaskpaneHeader
                header={props.destinationSheetIndex ? 
                    `Edit Pivot Table ${props.dfNames[props.destinationSheetIndex]}` 
                    : `Create Pivot Table ${props.dfNames[props.dfNames.length - 1]}`
                }
                setUIState={props.setUIState}
            />
            <DefaultTaskpaneBody>
                {error !== undefined && !error.includes("filter") &&
                    <p className='text-color-error'>{error}</p>
                }
                <DataframeSelect
                    title='Dataframe to pivot'
                    sheetDataArray={props.sheetDataArray}
                    sheetIndex={params.sourceSheetIndex}
                    onChange={(newSheetIndex) => {
                        // Set the selected index, and reset to the default params (taking no existing params)
                        const newParams = getDefaultPivotParams(props.sheetDataArray, newSheetIndex, undefined);
                        setParams(prevParams => {
                            return newParams || prevParams;
                        })
                    }}
                    sheetIndexToIgnore={props.destinationSheetIndex}
                />
                <div className = 'default-taskpane-body-section-div'>
                    <PivotTableKeySelection
                        mitoAPI={props.mitoAPI}
                        sheetData={sheetData}
                        sectionTitle='Rows'
                        params={params}
                        setParams={setParams}
                        rowOrColumn='pivotRowColumnIDsWithTransforms'
                    />
                </div>
                <div className = 'default-taskpane-body-section-div'>
                    <PivotTableKeySelection
                        mitoAPI={props.mitoAPI}
                        sheetData={sheetData}
                        sectionTitle='Columns'
                        params={params}
                        setParams={setParams}
                        rowOrColumn='pivotColumnsColumnIDsWithTransforms'
                    />
                </div>
                <div className='default-taskpane-body-section-div'>
                    <PivotTableValueSelection
                        mitoAPI={props.mitoAPI}
                        sheetData={sheetData}
                        params={params}
                        setParams={setParams}
                    />
                </div>
                <div className='default-taskpane-body-section-div'>
                    <PivotTableFilterSection
                        error={error}
                        sheetData={sheetData}
                        params={params}
                        setParams={setParams}
                        mitoAPI={props.mitoAPI}
                    />
                </div>
            </DefaultTaskpaneBody>
        </DefaultTaskpane> 
    ); 
}

export default PivotTaskpane;