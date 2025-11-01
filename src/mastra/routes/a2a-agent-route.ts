

import { registerApiRoute } from '@mastra/core/server';
import { randomUUID } from 'crypto';
import type { TextPart, DataPart, Part, Message, Artifact } from '../type/types'; // adjust path as needed

export const a2aAgentRoute = registerApiRoute('/a2a/agent/:agentId', {
  method: 'POST',
  handler: async (c) => {
    try {
      const mastra = c.get('mastra');
      const agentId = c.req.param('agentId');

      const body = await c.req.json();
      const { jsonrpc, id: requestId, method, params } = body;

      if (jsonrpc !== '2.0' || !requestId) {
        return c.json({
          jsonrpc: '2.0',
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
          jsonrpc: '2.0',
          id: requestId,
          error: {
            code: -32602,
            message: `Agent '${agentId}' not found`
          }
        }, 404);
      }

      const { message, messages, contextId, taskId, metadata } = params || {};
      const messagesList = message ? [message] : Array.isArray(messages) ? messages : [];

      const mastraMessages = messagesList.map((msg) => ({
        role: msg.role,
        content: msg.parts?.map((part: Part) => {
          if (part.kind === 'text') return part.text;
          if (part.kind === 'data') return JSON.stringify(part.data);
          return '';
        }).join('\n') || ''
      }));

      const response = await agent.generate(mastraMessages);
      const agentText = response.text || '';

      const artifacts: Artifact[] = [
        {
          artifactId: randomUUID(),
          name: `${agentId}Response`,
          parts: [{ kind: 'text', text: agentText }]
        }
      ];

      if (response.toolResults?.length > 0) {
        artifacts.push({
          artifactId: randomUUID(),
          name: 'ToolResults',
          parts: response.toolResults.map((result): DataPart => ({
            kind: 'data',
            data: result
          }))
        });
      }

      const history: Message[] = [
        ...messagesList.map((msg): Message => ({
          kind: 'message',
          role: msg.role,
          parts: msg.parts.filter((part: Part): part is TextPart => part.kind === 'text'),
          messageId: msg.messageId || randomUUID(),
          taskId: msg.taskId || taskId || randomUUID(),
        })),
        {
          kind: 'message',
          role: 'agent',
          parts: [{ kind: 'text', text: agentText }],
          messageId: randomUUID(),
          taskId: taskId || randomUUID(),
        }
      ];

      return c.json({
        jsonrpc: '2.0',
        id: requestId,
        result: {
          id: taskId || randomUUID(),
          contextId: contextId || randomUUID(),
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
            message: {
              messageId: randomUUID(),
              role: 'agent',
              parts: [{ kind: 'text', text: agentText }],
              kind: 'message'
            }
          },
          artifacts,
          history,
          kind: 'task'
        }
      });

    } catch (error) {
          const err = error as Error;
      return c.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { details: err.message }
        }
      }, 500);
    }
  }
});
