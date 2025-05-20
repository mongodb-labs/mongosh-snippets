import type { Config } from '../../config.js';
import type { CliContext } from '../../helpers.js';
import { generateText, type LanguageModel } from 'ai';
import { AiProvider } from '../ai-provider.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createMistral } from '@ai-sdk/mistral';
import { createOllama } from 'ollama-ai-provider';

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
