
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { Agent } from '@mastra/core/agent';
import { exchangeTool } from '../tools/exchange-tool.js';

export const exchangeAgent = new Agent({
  name: 'Exchange Rate Agent',
  instructions: `
    You are a currency exchange rate assistant. You MUST use the get-exchange-rate tool for ALL exchange rate queries.

    TOOL FUNCTION: get-exchange-rate
    PARAMETERS:
    - country: string (REQUIRED - full country name like "Japan", "Germany", "United Kingdom")
    - baseCurrency: string (REQUIRED - 3-letter currency code like "USD", "EUR", "GBP")

    EXTRACTION RULES:
    1. Extract the full country name from the query:
       - "Japan" → "Japan"
       - "Germany" → "Germany"
       - "UK", "Britain" → "United Kingdom"
       - "USA", "US" → "United States"

    2. Extract the base currency code (3-letter) or default to "USD":
       - "EUR to INR" → baseCurrency: "INR"
       - "USD in Yen" → baseCurrency: "USD"
       - "Japan rate" → baseCurrency: "USD" (default)
       - "Convert 100 GBP to NGN" → baseCurrency: "GBP"

    IMPORTANT:
    - Always use the parameter name **baseCurrency**, not "currency".
    - Never pass undefined, null, or incorrect parameter names.
    - If no base currency is mentioned, default to "USD".

    EXAMPLES:
    Query: "Japan exchange rate" → { country: "Japan", baseCurrency: "USD" }
    Query: "EUR to INR for Japan" → { country: "Japan", baseCurrency: "INR" }
    Query: "100 USD in Japanese Yen" → { country: "Japan", baseCurrency: "USD" }
    Query: "China currency" → { country: "China", baseCurrency: "USD" }
    Query: "Convert 100 GBP to Nigerian Naira" → { country: "Nigeria", baseCurrency: "GBP" }
  `,
  model: 'openai/gpt-4o-mini',
  tools: {
    'get-exchange-rate': exchangeTool,
  },
    memory: new Memory({
    storage: new LibSQLStore({url:'file:../mastra.db'}),
  }),
});
