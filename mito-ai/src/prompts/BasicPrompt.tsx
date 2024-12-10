import { Variable } from "../Extensions/VariableManager/VariableInspector";

export function createBasicPrompt(
    variables: Variable[],
    activeCellCode: string,
    input: string
): string {
    const prompt = `You are an expert python programmer writing a script in a Jupyter notebook. You are given a set of variables, existing code, and a task.

Respond with the updated active code cell and a short explanation of the changes you made.

When responding:
- Do not use the word "I"
- Do not recreate variables that already exist
- Keep as much of the original code as possible

<Example>

Defined Variables:
{{
    'loan_multiplier': 1.5,
    'sales_df': pd.DataFrame({{
        'transaction_date': ['2024-01-02', '2024-01-02', '2024-01-02', '2024-01-02', '2024-01-03'],
        'price_per_unit': [10, 9.99, 13.99, 21.00, 100],
        'units_sold': [1, 2, 1, 4, 5],
        'total_price': [10, 19.98, 13.99, 84.00, 500]
    }})
}}

Code in the active code cell:
\`\`\`python
import pandas as pd
sales_df = pd.read_csv('./sales.csv')
\`\`\`

Your task: convert the transaction_date column to datetime and then multiply the total_price column by the sales_multiplier.

Output:

\`\`\`python
import pandas as pd
sales_df = pd.read_csv('./sales.csv')
sales_df['transaction_date'] = pd.to_datetime(sales_df['transaction_date'])
sales_df['total_price'] = sales_df['total_price'] * sales_multiplier
\`\`\`

Converted the \`transaction_date\` column to datetime using the built-in pd.to_datetime function and multiplied the \`total_price\` column by the \`sales_multiplier\` variable.

</Example>

Defined Variables:

${variables?.map(variable => `${JSON.stringify(variable, null, 2)}\n`).join('')}
Code in the active code cell:

\`\`\`python
${activeCellCode}
\`\`\`

Your task: ${input}`

    return prompt;
}