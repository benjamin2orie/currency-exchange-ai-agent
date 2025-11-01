import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const inputSchema = z.object({
  country: z.string().min(2).describe("Country name to get currency from"),
  baseCurrency: z.string().length(3).describe("Base currency code (e.g., USD, EUR, GBP)")
});
const outputSchema = z.object({
  country: z.string(),
  base: z.string(),
  target: z.string(),
  rate: z.number(),
  currencyName: z.string(),
  lastUpdated: z.string(),
  success: z.boolean()
});
const exchangeTool = createTool({
  id: "get-exchange-rate",
  description: "Get exchange rate between base currency and target country's currency",
  inputSchema,
  outputSchema,
  execute: async ({ context }) => {
    const { country, baseCurrency } = context;
    try {
      console.log(`\u{1F30D} Fetching currency for: ${country}`);
      const countryResponse = await fetch(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}`
      );
      if (!countryResponse.ok) {
        throw new Error(`Country not found: ${country}`);
      }
      const countryData = await countryResponse.json();
      const countryInfo = Array.isArray(countryData) ? countryData[0] : countryData;
      if (!countryInfo?.currencies) {
        throw new Error(`No currency found for: ${country}`);
      }
      const targetCurrencyCode = Object.keys(countryInfo.currencies)[0];
      const currencyInfo = countryInfo.currencies[targetCurrencyCode];
      console.log(`\u{1F4B1} Fetching rate: ${baseCurrency} \u2192 ${targetCurrencyCode}`);
      const rateResponse = await fetch(
        `https://open.er-api.com/v6/latest/${baseCurrency}`
      );
      if (!rateResponse.ok) {
        throw new Error(`Exchange rate API error: ${rateResponse.status}`);
      }
      const rateData = await rateResponse.json();
      if (rateData.result === "error") {
        throw new Error(`Exchange rate error: ${rateData.error_type}`);
      }
      const exchangeRate = rateData.rates[targetCurrencyCode];
      if (!exchangeRate) {
        throw new Error(`No rate available for ${targetCurrencyCode}`);
      }
      return {
        country,
        base: baseCurrency,
        target: targetCurrencyCode,
        rate: exchangeRate,
        currencyName: currencyInfo.name,
        lastUpdated: rateData.time_last_update_utc,
        success: true
      };
    } catch (error) {
      console.error("Exchange tool error:", error);
      return {
        country: country || "Unknown",
        base: baseCurrency || "USD",
        target: "UNKNOWN",
        rate: 0,
        currencyName: "Unknown",
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        success: false
      };
    }
  }
});

export { exchangeTool };
