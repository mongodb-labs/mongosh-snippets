import process from 'process';
import { LoadingAnimation } from '../helpers';

export type CliContext = any;

export type GetResponseOptions = {
  systemPrompt?: string;
  signal: AbortSignal;
  expectedOutput: 'mongoshCommand' | 'text';
};

export abstract class AiProvider {
  thinking: LoadingAnimation;

  constructor(private readonly cliContext: CliContext) {
    this.thinking = new LoadingAnimation({
      message: 'Thinking...',
    });
  }

  /** @internal */
  getConnectionInfo() {
    return {
      connectionOptions: {
        connectionString: 'mongodb://localhost:27017',
      },
      id: '1234',
    };
  }

  /** @internal */
  getDatabaseContext(): {
    databaseName: string;
    collectionName: string;
  } {
    return {
      databaseName: this.cliContext.db._name,
      collectionName: '',
    };
  }

  /** @internal */
  setInput(text: string) {
    let actualText = text.replace('\n\n', '\n')
    process.stdin.unshift(actualText, 'utf-8');
  }
  /** @internal */
  respond(text: string) {
    process.stdout.write(text);
  }

  help() { 
  }

  async aggregate(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const systemPrompt =
      "You are a MongoDB and mongosh aggregation expert. Respond only with the exact mongosh aggregation command that matches the user's request. Only output the command, no explanation or formatting.";
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(this.cleanUpResponse(response, { expectedOutput: 'mongoshCommand' }));
  }

  async command(prompt: string,): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const systemPrompt =
      "You are a MongoDB and mongosh query expert. Respond only with a runnable mongosh command that matches the user's request. No explanation or formatting.";
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(this.cleanUpResponse(response, { expectedOutput: 'mongoshCommand' }));
  }

  async query(prompt: string,): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const systemPrompt =
      "You are a MongoDB and mongosh query expert. Respond only with the exact mongosh query command that matches the user's request. No explanation or formatting.";
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(this.cleanUpResponse(response, { expectedOutput: 'mongoshCommand' }));
  }

  cleanUpResponse(text: string, {
    expectedOutput,
  }: {
    expectedOutput: 'mongoshCommand' | 'text';
  }): string {
    if (expectedOutput === 'mongoshCommand') {
      return text.replace(/```\w*/g, '').replace(/```/g, '').trim();
    }
    
    return text;
  }

  abstract getResponse(prompt: string, {
    systemPrompt,
    signal,
    expectedOutput,
  }: {
    systemPrompt?: string;
    signal: AbortSignal;
    expectedOutput: 'mongoshCommand' | 'text';
  }): Promise<string>;

 async ask(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const response = await this.getResponse(prompt, {
      systemPrompt: 'You are a MongoDB and mongosh expert. Give brief answers without any formatting.',
      signal,
      expectedOutput: 'text',
    });

    this.thinking.stop();
    this.respond(this.cleanUpResponse(response, { expectedOutput: 'text' }));
  };
}

export class EmptyAiProvider extends AiProvider {
  readonly setupError =
    'ai snippet has not finished setup yet. Set MONGOSH_AI_PROVIDER={provider} if you need quick setup';

  async getResponse(prompt: string, {
    systemPrompt,
  }: {
    systemPrompt?: string;
  }): Promise<string> {
    throw new Error(this.setupError);
  }
}
