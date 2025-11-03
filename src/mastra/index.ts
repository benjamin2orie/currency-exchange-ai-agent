

import 'dotenv/config';
import { Mastra } from '@mastra/core';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { exchangeAgent } from './agents/exchange-agent.js';
import { a2aAgentRoute } from './routes/a2a-agent-route.js';
import { openaiProvider } from './providers/openapi-provider.js';
// import { groqProvider } from './providers/openapi-provider.js';

export const mastra = new Mastra({
  agents: { exchangeAgent },
  providers: [ openaiProvider],
  storage: new LibSQLStore({ url: ':memory:' }),
  logger: new PinoLogger({ name: 'Mastra', level: 'debug' }),
  observability: { default: { enabled: true } },
  server: {
    build: {
      openAPIDocs: true,
      swaggerUI: true,
    },
    apiRoutes: [a2aAgentRoute],
  },
} as any);
