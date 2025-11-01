import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';
import { OpenAI } from 'openai';

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

const exchangeAgent = new Agent({
  name: "Exchange Rate Agent",
  instructions: `
    You are a currency exchange rate assistant. You MUST use the get-exchange-rate tool for ALL exchange rate queries.

    TOOL FUNCTION: get-exchange-rate
    PARAMETERS:
    - country: string (REQUIRED - full country name like "Japan", "Germany", "United Kingdom")
    - baseCurrency: string (REQUIRED - 3-letter currency code like "USD", "EUR", "GBP")

    EXTRACTION RULES:
    1. Extract the full country name from the query:
       - "Japan" \u2192 "Japan"
       - "Germany" \u2192 "Germany"
       - "UK", "Britain" \u2192 "United Kingdom"
       - "USA", "US" \u2192 "United States"

    2. Extract the base currency code (3-letter) or default to "USD":
       - "EUR to INR" \u2192 baseCurrency: "INR"
       - "USD in Yen" \u2192 baseCurrency: "USD"
       - "Japan rate" \u2192 baseCurrency: "USD" (default)
       - "Convert 100 GBP to NGN" \u2192 baseCurrency: "GBP"

    IMPORTANT:
    - Always use the parameter name **baseCurrency**, not "currency".
    - Never pass undefined, null, or incorrect parameter names.
    - If no base currency is mentioned, default to "USD".

    EXAMPLES:
    Query: "Japan exchange rate" \u2192 { country: "Japan", baseCurrency: "USD" }
    Query: "EUR to INR for Japan" \u2192 { country: "Japan", baseCurrency: "INR" }
    Query: "100 USD in Japanese Yen" \u2192 { country: "Japan", baseCurrency: "USD" }
    Query: "China currency" \u2192 { country: "China", baseCurrency: "USD" }
    Query: "Convert 100 GBP to Nigerian Naira" \u2192 { country: "Nigeria", baseCurrency: "GBP" }
  `,
  model: "openai/gpt-4o-mini",
  tools: {
    "get-exchange-rate": exchangeTool
  },
  memory: new Memory({
    storage: new LibSQLStore({ url: "file:../mastra.db" })
  })
});

const a2aAgentRoute = registerApiRoute("/a2a/agent/:agentId", {
  method: "POST",
  handler: async (c) => {
    try {
      const mastra = c.get("mastra");
      const agentId = c.req.param("agentId");
      const body = await c.req.json();
      const { jsonrpc, id: requestId, params } = body;
      if (jsonrpc !== "2.0" || !requestId) {
        return c.json({
          jsonrpc: "2.0",
          id: requestId || null,
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0" and id is required'
          }
        }, 400);
      }
      const agent = mastra.getAgent(agentId);
      if (!agent) {
        return c.json({
          jsonrpc: "2.0",
          id: requestId,
          error: {
            code: -32602,
            message: `Agent '${agentId}' not found`
          }
        }, 404);
      }
      const { message, messages, contextId, taskId} = params || {};
      const messagesList = message ? [message] : Array.isArray(messages) ? messages : [];
      const mastraMessages = messagesList.map((msg) => ({
        role: msg.role,
        content: msg.parts?.map((part) => {
          if (part.kind === "text") return part.text;
          if (part.kind === "data") return JSON.stringify(part.data);
          return "";
        }).join("\n") || ""
      }));
      const response = await agent.generate(mastraMessages);
      const agentText = response.text || "";
      const artifacts = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: "text", text: agentText }]
        }
      ];
      if (response.toolResults?.length > 0) {
        artifacts.push({
          artifactId: randomUUID(),
          name: "ToolResults",
          parts: response.toolResults.map((result) => ({
            kind: "data",
            data: result
          }))
        });
      }
      const history = [
        ...messagesList.map((msg) => ({
          kind: "message",
          role: msg.role,
          parts: msg.parts.filter((part) => part.kind === "text"),
          messageId: msg.messageId || randomUUID(),
          taskId: msg.taskId || taskId || randomUUID()
        })),
        {
          kind: "message",
          role: "agent",
          parts: [{ kind: "text", text: agentText }],
          messageId: randomUUID(),
          taskId: taskId || randomUUID()
        }
      ];
      return c.json({
        jsonrpc: "2.0",
        id: requestId,
        result: {
          id: taskId || randomUUID(),
          contextId: contextId || randomUUID(),
          status: {
            state: "completed",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            message: {
              messageId: randomUUID(),
              role: "agent",
              parts: [{ kind: "text", text: agentText }],
              kind: "message"
            }
          },
          artifacts,
          history,
          kind: "task"
        }
      });
    } catch (error) {
      const err = error;
      return c.json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal error",
          data: { details: err.message }
        }
      }, 500);
    }
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
console.log(process.env.OPENAI_API_KEY);
const openaiProvider = {
  id: "openai",
  models: {
    "openai/gpt-4o-mini": async ({ messages }) => {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-4o-mini",
        messages
      });
      return {
        text: response.choices[0]?.message?.content || ""
      };
    }
  }
};

const mastra = new Mastra({
  agents: {
    exchangeAgent
  },
  providers: [openaiProvider],
  storage: new LibSQLStore({
    url: ":memory:"
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "debug"
  }),
  observability: {
    default: {
      enabled: true
    }
  },
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true
    },
    apiRoutes: [a2aAgentRoute]
  }
});

export { mastra };
