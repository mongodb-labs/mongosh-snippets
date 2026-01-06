import { createOpenAI } from '@ai-sdk/openai';
import { createMistral } from '@ai-sdk/mistral';
import { createOllama } from 'ollama-ai-provider-v2';

export const models = {
  mongodb(model = 'mongodb-chat-latest') {
    return createOpenAI({
      baseURL: 'https://knowledge.mongodb.com/api/v1',
      apiKey: '',
      headers: {
        'X-Request-Origin': `mongodb-mongosh`,
        'user-agent': `mongodb-mongosh`,
      },
    }).responses(model);
  },
  ollama(model = 'unknown') {
    return createOllama().languageModel(model);
  },
  mistral(model = 'mistral-small-latest') {
    return createMistral({
      apiKey: process.env.MONGOSH_AI_MISTRAL_API_KEY,
    }).languageModel(model);
  },
  openai(model = 'gpt-5.1-codex-mini') {
    return createOpenAI({
      apiKey: process.env.MONGOSH_AI_OPENAI_API_KEY,
    }).languageModel(model);
  },
};

export type Models = keyof typeof models;
