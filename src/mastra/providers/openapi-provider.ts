

// import 'dotenv/config';
// import type { ModelProvider } from '../type/types.js';
// import { OpenAI } from 'openai';

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });
//  //openai/gpt-4o-mini last used
//  //openai/gpt-3.5-turbo'
// console.log(process.env.OPENAI_API_KEY)
// export const openaiProvider: ModelProvider = {
//   id: 'openai',
//   models: {
//     'openai/gpt-oss-20b': async ({ messages }:any) => {
//       const response = await openai.chat.completions.create({
//         model: 'openai/gpt-oss-20b',
//         messages,
//       });

//       return {
//         text: response.choices[0]?.message?.content || '',
//       };
//     },
//   },
// };






import 'dotenv/config';
import type { ModelProvider } from '../type/types.js';

export const groqProvider : ModelProvider = {
  id: 'groq',
  models: {
    'groq/llama-3.1-8b-instant': async ({ messages }: any) => {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'groq/llama-3.1-8b-instant',
          messages,
          temperature: 1,
          max_tokens: 8192,
          top_p: 1,
          reasoning_effort: 'medium',
          stream: false, // Set to true if you want to handle streaming manually
          stop: null
        }),
      });

      const data = await response.json();

      return {
        text: data.choices?.[0]?.message?.content || '',
      };
    },
  },
};


