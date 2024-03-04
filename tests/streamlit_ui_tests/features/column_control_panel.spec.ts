import { FrameLocator, Page, expect, test } from '@playwright/test';
import { awaitResponse, getMitoFrameWithTestCSV } from '../utils';



const openColumnControlPanel = async (mito: any, columnName: string) => {
    const columnHeader = await mito.locator('.endo-column-header-final-container', { hasText: columnName });
    await columnHeader.getByText('int').click();
    await expect(mito.locator('.spacing-col', { hasText: 'Dtype' })).toBeVisible();
};

const changeDtype = async (mito: FrameLocator, page: Page, dtype: string) => {
    await mito.locator('.spacing-row', { hasText: 'Dtype' }).locator('.select-text').click();
    await mito.locator('.mito-dropdown-item', { hasText: dtype }).click();
    await awaitResponse(page);
}

const changeNumType = async (mito: FrameLocator, page: Page, numType: string) => {
    await mito.locator('.spacing-row', { hasText: 'Num Type' }).locator('.select-text').click();
    await mito.locator('.mito-dropdown-item', { hasText: numType }).click();
    await awaitResponse(page);
}

const checkColumnCellsHaveValues = async (mito: FrameLocator, columnIndex: number, values: any[]) => {
    const cells = await mito.locator(`.mito-grid-cell[mito-col-index="${columnIndex}"]`).all()
    await expect(mito.locator('.index-header-container')).toHaveCount(values.length);
    for (const cellIndex in values) {
        const cell = cells[cellIndex];
        await expect(cell).toHaveText(values[cellIndex]);
    }
}

const checkColumnControlPanelValuesTab = async (mito: FrameLocator, expectedValues: any[]) => {
    const values = await mito.locator('.multi-toggle-box').locator('.multi-toggle-box-row').all();
    for (const valueIndex in values) {
        const value = values[valueIndex];
        await expect(value).toHaveText(expectedValues[valueIndex]);
    }
};

test.describe('Column Control Panel', () => {
    test('Changing dtype', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        
        await openColumnControlPanel(mito, 'Column1');
        
        await changeDtype(mito, page, 'bool');
        await checkColumnCellsHaveValues(mito, 0, ['true', 'true', 'true', 'true']);

        await changeDtype(mito, page, 'str');
        await checkColumnCellsHaveValues(mito, 0, ['1', '4', '7', '10']);
    
        await changeDtype(mito, page, 'float');
        await checkColumnCellsHaveValues(mito, 0, ['1.00', '4.00', '7.00', '10.00']);
    
        await changeDtype(mito, page, 'datetime');
        await checkColumnCellsHaveValues(mito, 0, ['1970-01-01 00:00:01', '1970-01-01 00:00:04', '1970-01-01 00:00:07', '1970-01-01 00:00:10']);
    })

    test('Adding filter', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        
        await openColumnControlPanel(mito, 'Column1');
        
        await mito.getByText('Add Filter').click();
        await mito.getByText('Add a Filter').click();
        await mito.locator('.spacing-row', { hasText: 'Where' }).locator('input').fill('4');
        await awaitResponse(page);

        await checkColumnCellsHaveValues(mito, 0, ['7', '10']);
    });

    test('Sorting', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        
        await openColumnControlPanel(mito, 'Column1');
    
        await mito.getByText('Descending').click();
        await awaitResponse(page);

        await checkColumnCellsHaveValues(mito, 0, ['10', '7', '4', '1']);

        await mito.getByText('Ascending').click();
        await awaitResponse(page);

        await checkColumnCellsHaveValues(mito, 0, ['1', '4', '7', '10']);
    });

    test('Change the number type', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        await openColumnControlPanel(mito, 'Column1');

        await changeNumType(mito, page, 'Currency');
        await checkColumnCellsHaveValues(mito, 0, ['$1', '$4', '$7', '$10']);

        await changeNumType(mito, page, 'Accounting');
        await checkColumnCellsHaveValues(mito, 0, ['$1', '$4', '$7', '$10']);

        await changeNumType(mito, page, 'Percent');
        await checkColumnCellsHaveValues(mito, 0, ['100%', '400%', '700%', '1,000%']);

        await changeNumType(mito, page, 'Scientific Notation');
        await checkColumnCellsHaveValues(mito, 0, ['1e+0', '4e+0', '7e+0', '1e+1']);
    });

    test('Values tab: filtering values by clicking on them', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        await openColumnControlPanel(mito, 'Column1');

        await mito.locator('.control-panel-taskpane-tab', { hasText: 'Values'}).click();
        await checkColumnControlPanelValuesTab(mito, ['1', '4', '7', '10']);

        await mito.locator('.multi-toggle-box-row', { hasText: '4' }).locator('input[type="checkbox"]').click();
        await awaitResponse(page);
        await checkColumnCellsHaveValues(mito, 0, ['1', '7', '10']);
    })

    test('Loads summary stats', async ({ page }) => {
        const mito = await getMitoFrameWithTestCSV(page);
        await openColumnControlPanel(mito, 'Column1');

        await mito.locator('.control-panel-taskpane-tab', { hasText: 'Stats'}).click();
        await expect(mito.locator('.column-describe-table-row', { hasText: 'mean' })).toContainText('5.5')
        await expect(mito.locator('.column-describe-table-row', { hasText: 'std' })).toContainText('3.87')
        await expect(mito.locator('.column-describe-table-row', { hasText: 'min' })).toContainText('1.0')
    })
    
});