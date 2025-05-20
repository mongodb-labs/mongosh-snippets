import { AiProvider } from '../ai-provider.js';
import chalk from 'chalk';
import { DocsChatbotAIService } from './docs-chatbot-service.js';

import type { GetResponseOptions } from '../ai-provider.js';
import type { CliContext } from '../../helpers.js';
import type { Config } from '../../config.js';
import type { DocsChatbotAIService as DocsChatbotAIServiceType } from './docs-chatbot-service.js';

export class DocsAiProvider extends AiProvider {
  private docsConversation: { id: string } | null = null;

  constructor(
    private readonly aiService: DocsChatbotAIServiceType,
    cliContext: CliContext,
    config: Config,
  ) {
    super(cliContext, config);
  }

  async getResponse(
    prompt: string,
    { systemPrompt, signal, expectedOutput }: GetResponseOptions,
  ): Promise<string> {
    try {
    // Initialize conversation if not exists
    if (!this.docsConversation) {
      const conv = await this.aiService.createConversation({
        signal,
      });

      this.docsConversation = { id: conv.conversationId };
    }

    const response = await this.aiService.addMessage({
      conversationId: this.docsConversation?.id ?? '',
      message: systemPrompt ? 'System prompt: ' + systemPrompt + '\n\n User prompt: ' + prompt : prompt,
      signal,
    });

    let formattedResponse = response.content;
    if (expectedOutput === 'text') {
      // Format and display the response
      formattedResponse = chalk.blue.bold('Answer: ') + response.content;

      // Add references if they exist
      if (response.references && response.references.length > 0) {
        formattedResponse += '\n\n';
        formattedResponse += chalk.gray(
          response.references
            .map((ref) => `${chalk.bold(ref.title)}: ${ref.url}`)
            .join('; '),
        );
      }

      // Add suggested prompts if they exist
      if (response.suggestedPrompts && response.suggestedPrompts.length > 0) {
        formattedResponse +=
          '\n\n' + chalk.green.bold('Suggested follow-up questions:') + '\n';
        response.suggestedPrompts.forEach((prompt) => {
          formattedResponse += chalk.green(`- ${prompt}\n`);
          });
        }
      }
      // Send message and get response
      return formattedResponse;
    } catch (error) {
      this.thinking.stop();
      throw error;
    }
  }
}

export function getDocsAiProvider(
  cliContext: CliContext,
  config: Config,
): DocsAiProvider {
  const aiService = new DocsChatbotAIService();
  return new DocsAiProvider(aiService, cliContext, config);
}
