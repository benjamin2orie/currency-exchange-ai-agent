

import 'dotenv/config';
import { exchangeAgent } from './agents/exchange-agent.js';

async function testGPT4Agent() {
  console.log('🧪 Testing GPT-4o-mini Agent with Tool Calling...\n');
  
  const testQueries = [
    'What is the exchange rate for Japan to NGN?',
    'Show me USD to Euro rate for Germany',
    'How much is 100 USD in British Pounds?',
    'China exchange rate',
    'Get me the current JPY to USD rate'
  ];

  for (const query of testQueries) {
    try {
      console.log(`📝 Query: "${query}"`);
      
      const response = await exchangeAgent.generate(query);
      
      console.log('✅ Response received!');
      console.log('Response text:', response.text);
      console.log('Tool calls:', response.steps[0]?.toolCalls?.length || 0);
      console.log('Tool results:', response.steps[0]?.toolResults?.length || 0);
      
      if (response.steps[0]?.toolResults?.length > 0) {
        console.log('🎉 TOOL WAS USED!');
        const result = response.steps[0].toolResults[0];
        console.log('Tool result:', result);
      } else {
        console.log('❌ Tool was not used');
      }
      
      console.log('---\n');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('---\n');
    }
  }
}

testGPT4Agent();