import { AiProvider, CliContext, GetResponseOptions } from '../ai-provider';
import { DocsChatbotAIService, MessageData } from './docs-chatbot-service';
import chalk from 'chalk';

export class DocsAiProvider extends AiProvider {
  private conversation: { id: string } | null = null;

  constructor(
    private readonly aiService: DocsChatbotAIService,
    cliContext: CliContext,
  ) {
    super(cliContext);
  }

  async getResponse(
    prompt: string,
    {
      systemPrompt,
      signal,
      expectedOutput,
    }: GetResponseOptions,
  ): Promise<string> {
      // Initialize conversation if not exists
      if (!this.conversation) {
        this.thinking.start(signal);
        const conv = await this.aiService.createConversation({
          signal,
        });

        this.conversation = { id: conv.conversationId }; 
      }

      const response = await this.aiService.addMessage({
        conversationId: this.conversation.id,
        message: prompt,
        signal,
      });

      let formattedResponse = response.content;
      if (expectedOutput === 'text') {
        // Format and display the response
        formattedResponse = chalk.blue.bold('Answer:\n') + response.content;

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
  }

  async aggregate(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);

    this.thinking.start(signal);

    const wrappedPrompt = `Tell me the mongosh command for aggregating that would fit this prompt: ${prompt}. Do not say anything else. Do not use any formatting. Return the command.`;
    const response = await this.getResponse(wrappedPrompt, {
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();

    this.setInput(response);
  }

  async query(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);

    this.thinking.start(signal);

    const wrappedPrompt = `${prompt}. Do not say anything else. Do not use any formatting. Return the command.`;
    const response = await this.getResponse(wrappedPrompt, {
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();

    this.setInput(response);
  }

  async ask(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);
    this.thinking.start(signal);

    const response = await this.getResponse(prompt, {
      signal,
      expectedOutput: 'text',
    });

    this.thinking.stop();

    this.respond(response);
  }
}

export function getDocsAiProvider(cliContext: CliContext): DocsAiProvider {
  const aiService = new DocsChatbotAIService();
  return new DocsAiProvider(aiService, cliContext);
}
