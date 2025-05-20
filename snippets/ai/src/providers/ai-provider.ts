const _localRequire = require('module').createRequire(__filename);
const localRequire = <T>(module: string): T => _localRequire(module);
const process = localRequire<typeof import('process')>('process');
const { formatHelpCommands, LoadingAnimation } = localRequire<typeof import('../helpers.js')>('../helpers.js');
const chalk = localRequire<typeof import('chalk')>('chalk');

import type { CoreMessage } from 'ai';
import type { Config } from '../config.js';
import type { LoadingAnimation as LoadingAnimationType } from '../helpers.js';

export type CliContext = any;

export type GetResponseOptions = {
  systemPrompt?: string;
  signal: AbortSignal;
  expectedOutput: 'mongoshCommand' | 'text';
};

export abstract class AiProvider {
  thinking: LoadingAnimationType;
  conversation: { messages: CoreMessage[] } = {
    messages: [],
  };

  public session: {
    collection: string | undefined;
  };

  constructor(
    private readonly cliContext: CliContext,
    private readonly config: Config,
  ) {
    this.thinking = new LoadingAnimation({
      message: 'Thinking...',
    });
    this.session = {
      collection: this.config.get('defaultCollection'),
    };
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
      collectionName: this.session.collection ?? '',
    };
  }

  /** @internal */
  async getSampleDocuments(
    collectionName: string,
  ): Promise<Record<string, unknown>[]> {
    return (
      await this.cliContext.db.getCollection(collectionName).aggregate([
        {
          $sample: { size: 3 },
        },
      ])
    ).toArray();
  }

  /** @internal */
  setInput(text: string) {
    const trimmedText = text.trim();
    if (/[\n\r]/.test(trimmedText)) {
      // If the text includes a newline or carriage return, we should enter editor mode first
      process.stdin.unshift('.editor\n', 'utf-8');
    }
    process.stdin.unshift(trimmedText, 'utf-8');
  }
  /** @internal */
  respond(text: string) {
    process.stdout.write(text);
  }

  help({ model, provider }: { model: string; provider: string }) {
    const commands = [
      {
        cmd: 'ai.ask',
        desc: 'ask MongoDB questions',
        example: 'ai.ask how do I run queries in mongosh?',
      },
      {
        cmd: 'ai.data',
        desc: 'generate data-related mongosh commands',
        example: 'ai.data insert some sample user info',
      },
      {
        cmd: 'ai.query',
        desc: 'generate a MongoDB query',
        example: 'ai.query find documents where name = "Ada"',
      },
      {
        cmd: 'ai.aggregate',
        desc: 'generate a MongoDB aggregation',
        example: 'ai.aggregate find documents where name = "Ada"',
      },
      {
        cmd: 'ai.collection',
        desc: 'set the active collection',
        example: 'ai.collection("users")',
      },
      {
        cmd: 'ai.shell',
        desc: 'generate administrative mongosh commands',
        example: 'ai.shell get sharding info',
      },
      {
        cmd: 'ai.general',
        desc: 'use your model for general questions',
        example: 'ai.general what is the meaning of life?',
      },
      {
        cmd: 'ai.config',
        desc: 'configure the AI commands',
        example: 'ai.config.set("provider", "ollama")',
      },
    ];

    this.respond(
      formatHelpCommands(commands, {
        provider,
        model,
        collection: this.session.collection,
      }),
    );
  }

  async ensureCollectionName(prompt: string): Promise<void> {
    if (!this.session.collection) {
      // Try to get the collection name from the current database if there's only one
      const collections = await this.cliContext.db.getCollectionNames();
      if (collections.length === 1) {
        this.session.collection = collections[0];
        this.respond(
          `Active collection set to ${chalk.blue(this.session.collection)}. Use ${chalk.yellow('ai.collection')} to set a different collection.`,
        );
      } else {
        const response = await this.getResponse(
          'User\'s prompt: ' + prompt, {
            systemPrompt: "A user prompted about something which is likely related to a collection. You pick the collection that clearly matches the user's request. The collections to you have access to are: " + collections.join('; ') + ". If there is no clear match or if no collection is needed, return 'none'. Otherwise, return the collection name. Output only the collection name and nothing else, without formatting.",
          signal: AbortSignal.timeout(30_000),
          expectedOutput: 'text',
        });
        if (collections.includes(response)) {
          this.session.collection = response;
          this.respond(
            `Active collection was determined to be ${chalk.blue(this.session.collection)}. Use ${chalk.yellow('ai.collection')} to set a different collection.\n`,
          );
        } else {
          throw new Error(
            `No active collection set. Use ${chalk.yellow('ai.collection("collection_name")')} to set a collection.\nCollections in ${chalk.white(this.cliContext.db._name)}: ${chalk.gray(
              collections.join(', '),
            )}`,
          );
        }
      }
    }
  }

  private async getSystemPrompt(
    systemPrompt: string,
    {
      includeSampleDocs = false,
    }: {
      includeSampleDocs?: boolean;
    },
  ): Promise<string> {
    return (
      `You are a MongoDB and mongosh expert. ${systemPrompt}. Do not provide any text, explanation or formatting.` +
      `Current Database: ${this.cliContext.db._name}. ` +
      (this.session.collection
        ? `Current Collection: ${this.session.collection}. `
        : '') +
      (includeSampleDocs &&
      this.session.collection &&
      this.config.get('includeSampleDocs')
        ? `Sample documents from ${this.cliContext.db._name}.${this.session.collection}: ${JSON.stringify(
            await this.getSampleDocuments(this.session.collection),
          )}. Skip the use command to switch to the database, it is already set.`
        : '')
    );
  }

  async collection(prompt: string | undefined): Promise<void> {
    this.session.collection = prompt;
    this.respond(`Active collection set to ${chalk.blue(prompt ?? 'none')}`);
  }

  async aggregate(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    await this.ensureCollectionName(prompt);

    this.thinking.start(signal);

    const systemPrompt = await this.getSystemPrompt(
      "You generate the exact mongosh aggregate command that matches the user's request",
      { includeSampleDocs: true },
    );
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(
      this.formatResponse(response, { expectedOutput: 'mongoshCommand' }),
    );
  }

  async shell(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);

    this.thinking.start(signal);

    const systemPrompt = await this.getSystemPrompt(
      "You generate a runnable mongosh command that matches the user's request",
      { includeSampleDocs: false },
    );
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(
      this.formatResponse(response, { expectedOutput: 'mongoshCommand' }),
    );
  }

  async general(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const response = await this.getResponse(prompt, {
      systemPrompt: 'Give brief answers without any formatting or markdown.',
      signal,
      expectedOutput: 'text',
    });

    this.thinking.stop();
    this.respond(this.formatResponse(response, { expectedOutput: 'text' }));
  }

  async data(prompt: string): Promise<void> {
    await this.ensureCollectionName(prompt);
    const signal = AbortSignal.timeout(30_000);

    this.thinking.start(signal);

    const systemPrompt = await this.getSystemPrompt(
      "You generate a runnable mongosh command that matches the user's request",
      { includeSampleDocs: true },
    );
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(
      this.formatResponse(response, { expectedOutput: 'mongoshCommand' }),
    );
  }

  async query(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    await this.ensureCollectionName(prompt);

    this.thinking.start(signal);

    const systemPrompt = await this.getSystemPrompt(
      "You generate the exact mongosh find command that matches the user's request.",
      { includeSampleDocs: true },
    );
    const response = await this.getResponse(prompt, {
      systemPrompt,
      signal,
      expectedOutput: 'mongoshCommand',
    });

    this.thinking.stop();
    this.setInput(
      this.formatResponse(response, { expectedOutput: 'mongoshCommand' }),
    );
  }

  formatResponse(
    text: string,
    {
      expectedOutput,
    }: {
      expectedOutput: 'mongoshCommand' | 'text';
    },
  ): string {
    if (expectedOutput === 'mongoshCommand') {
      // Often the models will return a command in a markdown code block, which we don't want
      return text
        .replace(/```\w*/g, '')
        .replace(/```/g, '')
        .trim();
    }

    return chalk.blue.bold('Answer: ') + text;
  }

  abstract getResponse(
    prompt: string,
    {
      systemPrompt,
      signal,
      expectedOutput,
    }: {
      systemPrompt?: string;
      signal: AbortSignal;
      expectedOutput: 'mongoshCommand' | 'text';
    },
  ): Promise<string>;

  async ask(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    this.thinking.start(signal);

    const response = await this.getResponse(prompt, {
      systemPrompt:
        'You are a MongoDB and mongosh expert. Give brief answers without any formatting.',
      signal,
      expectedOutput: 'text',
    });

    this.thinking.stop();
    this.respond(this.formatResponse(response, { expectedOutput: 'text' }));
  }

  public clear() {
    this.session = {
      collection: this.config.get('defaultCollection'),
    };
    this.respond('Session cleared');
  }
}

export class EmptyAiProvider extends AiProvider {
  readonly setupError =
    'ai snippet has not finished setup yet. Set MONGOSH_AI_PROVIDER={provider} if you need quick setup';

  async getResponse(
    prompt: string,
    {
      systemPrompt,
    }: {
      systemPrompt?: string;
    },
  ): Promise<string> {
    throw new Error(this.setupError);
  }
}
