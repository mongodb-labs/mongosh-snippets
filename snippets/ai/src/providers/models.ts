import { createOpenAI } from '@ai-sdk/openai';
import { createMistral } from '@ai-sdk/mistral';
import { createOllama } from 'ollama-ai-provider-v2';

export const models = {
  docs(model = 'mongodb-chat-latest') {
    return createOpenAI({
      baseURL: 'https://knowledge.mongodb.com/api/v1',
      apiKey: '',
      headers: {
        // TODO: Change to actual origin
        'X-Request-Origin': 'mongodb-compass',
        origin: 'mongodb-compass',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) MongoDBCompass/1.47.0 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36',
      },
      fetch: (url, options) => {
        return fetch(url, {
          body: {
            ...((options?.body as unknown as Record<string, unknown>) ?? {}),
            // @ts-expect-error - store is not a known property
            store: false,
          },
          ...options,
        });
      },
    }).responses(model);
  },
  ollama(model = 'qwen2.5-coder:7b') {
    return createOllama().languageModel(model);
  },
  mistral(model = 'mistral-small-latest') {
    return createMistral({
      apiKey: process.env.MONGOSH_AI_API_KEY,
    }).languageModel(model);
  },
  openai(model = 'gpt-4.1-mini') {
    return createOpenAI({
      apiKey: process.env.MONGOSH_AI_API_KEY,
    }).languageModel(model);
  },
};

export type Models = keyof typeof models;
