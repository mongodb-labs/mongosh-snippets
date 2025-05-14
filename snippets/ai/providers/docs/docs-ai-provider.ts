import { AiProvider } from '../ai-provider';
import { DocsChatbotAIService } from './docs-chatbot-service';

export class DocsAiProvider extends AiProvider {
  private conversation: { id: string } | null = null;
  
  constructor(private readonly aiService: DocsChatbotAIService) {
    super();
  }

  async query(prompt: string): Promise<void> {
    // The query operation is not supported for docs
    this.respond('The query operation is not supported by the Docs AI provider.');
  }

  async ask(prompt: string): Promise<void> {
    try {
      // Initialize conversation if not exists
      if (!this.conversation) {
        const signal = AbortSignal.timeout(10000);

        this.thinking.start(signal);
        const conv = await this.aiService.createConversation({
          signal,
        });

        this.conversation = { id: conv.conversationId };
      } 

      // Send message and get response
      const response = await this.aiService.addMessage({
        conversationId: this.conversation.id,
        message: `
        ${prompt}
        
        Give a very brief answer.
        `,
        signal: AbortSignal.timeout(30000),
      });

      this.thinking.stop();

      // Format and display the response
      let formattedResponse = response.content;
      
      // Add references if they exist
      if (response.references && response.references.length > 0) {
        formattedResponse += '\n\nReferences:\n';
        response.references.forEach((ref) => {
          formattedResponse += `- ${ref.title}: ${ref.url}\n`;
        });
      }

      // Add suggested prompts if they exist
      if (response.suggestedPrompts && response.suggestedPrompts.length > 0) {
        formattedResponse += '\n\nSuggested follow-up questions:\n';
        response.suggestedPrompts.forEach((prompt) => {
          formattedResponse += `- ${prompt}\n`;
        });
      }

      this.respond(formattedResponse);
    } catch (error) {
      this.respond(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    }
  }
}

export function getDocsAiProvider(): DocsAiProvider {
  const aiService = new DocsChatbotAIService();
  return new DocsAiProvider(aiService);
}
