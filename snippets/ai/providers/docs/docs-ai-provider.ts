import { AiProvider, CliContext } from '../ai-provider';
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

  private async askChatbot(
    prompt: string,
    signal: AbortSignal,
  ): Promise<MessageData> {
    // Initialize conversation if not exists
    if (!this.conversation) {
      this.thinking.start(signal);
      const conv = await this.aiService.createConversation({
        signal,
      });

      this.conversation = { id: conv.conversationId };
    }

    // Send message and get response
    return await this.aiService.addMessage({
      conversationId: this.conversation.id,
      message: prompt,
      signal,
    });
  }

  async aggregate(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);

    this.thinking.start(signal);

    const wrappedPrompt = `Tell me the mongosh command for aggregating that would fit this prompt: ${prompt}. Do not say anything else. Do not use any formatting. Return the command.`;
    const response = await this.askChatbot(wrappedPrompt, signal);

    this.thinking.stop();

    this.setInput(response.content);
  }

  async query(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);

    this.thinking.start(signal);

    const wrappedPrompt = `Tell me the mongosh command for querying that would fit this prompt: ${prompt}. Do not say anything else. Do not use any formatting. Return the command.`;
    const response = await this.askChatbot(wrappedPrompt, signal);

    this.thinking.stop();

    this.setInput(response.content);
  }

  async ask(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(10_000);
    this.thinking.start(signal);

    const response = await this.askChatbot(
      `${prompt}. Give very brief answers.`,
      signal,
    );

    this.thinking.stop();

    // Format and display the response
    let formattedResponse = chalk.blue.bold('Answer:\n') + response.content;

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

    this.respond(formattedResponse);
  }
}

export function getDocsAiProvider(cliContext: CliContext): DocsAiProvider {
  const aiService = new DocsChatbotAIService();
  return new DocsAiProvider(aiService, cliContext);
}
