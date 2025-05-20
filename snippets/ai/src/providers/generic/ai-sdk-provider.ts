const _localRequire = require('module').createRequire(__filename);
const localRequire = <T>(module: string): T => _localRequire(module);

const { AiProvider } = localRequire<typeof import('../ai-provider.js')>('../ai-provider.js');
const {  generateText } = localRequire<typeof import('ai')>('ai');
const { createOpenAI } = localRequire<typeof import('@ai-sdk/openai')>('@ai-sdk/openai');
const { createMistral } = localRequire<typeof import('@ai-sdk/mistral')>('@ai-sdk/mistral');
const { createOllama } = localRequire<typeof import('ollama-ai-provider')>('ollama-ai-provider');


import type { Config } from '../../config.js';
import type { CliContext } from '../../helpers.js';
import type { LanguageModel } from 'ai';

export class AiSdkProvider extends AiProvider {
  constructor(
    private readonly model: LanguageModel,
    config: Config,
    cliContext: CliContext,
  ) {
    super(cliContext, config);
    this.model = model;
  }

  async getResponse(
    prompt: string,
    {
      systemPrompt,
      signal,
    }: {
      systemPrompt?: string;
      signal: AbortSignal;
    },
  ): Promise<string> {
    this.conversation.messages.push({ role: 'user', content: prompt });

    try {
      const { text } = await generateText({
        model: this.model,
        messages: this.conversation.messages,
        system: systemPrompt,
        abortSignal: signal,
      });

      const aiResponse = text;

      this.conversation.messages.push({
        role: 'assistant',
        content: aiResponse,
      });
      return aiResponse;
    } catch (error) {
      this.conversation.messages.pop();
      throw new Error(`Error generating text: ${error as string}`);
    }
  }
}

export const models = {
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

export function getAiSdkProvider(
  model: LanguageModel,
  cliContext: CliContext,
  config: Config,
): AiSdkProvider {
  return new AiSdkProvider(model, config, cliContext);
}
