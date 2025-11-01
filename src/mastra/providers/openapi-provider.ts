

import 'dotenv/config';
import type { ModelProvider } from '../type/types.js';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log(process.env.OPENAI_API_KEY)
export const openaiProvider: ModelProvider = {
  id: 'openai',
  models: {
    'openai/gpt-4o-mini': async ({ messages }:any) => {
      const response = await openai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages,
      });

      return {
        text: response.choices[0]?.message?.content || '',
      };
    },
  },
};

