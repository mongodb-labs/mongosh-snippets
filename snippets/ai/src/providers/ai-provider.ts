import { generateText, streamText, LanguageModel, ModelMessage } from 'ai';
import type { Config } from '../config.js';
import {
  type LoadingAnimation as LoadingAnimationType,
  type CliContext,
  LoadingAnimation,
} from '../helpers.js';
import chalk from 'chalk';
import { models } from './models.js';

export type GetResponseOptions = {
  systemPrompt?: string;
  signal?: AbortSignal;
  expectedOutput: 'command' | 'response';
};

export class AiProvider {
  private readonly thinking: LoadingAnimationType;

  private session: {
    messages: ModelMessage[];
    collection: string | undefined;
  } = {
    messages: [],
    collection: undefined,
  };
  public model: LanguageModel;

  constructor(
    private readonly cliContext: CliContext,
    private readonly config: Config,
    initialModel: LanguageModel,
  ) {
    this.thinking = new LoadingAnimation({
      message: 'Thinking...',
    });
    this.session = {
      messages: [],
      collection: this.config.get('defaultCollection'),
    };
    this.model = initialModel;
  }

  get activeProvider(): string {
    return this.config.get('provider');
  }

  get activeModel(): string {
    return this.config.get('model');
  }

  get activeCollection(): string | undefined {
    return this.session.collection;
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
    this.thinking.stop();
    process.stdout.write(text);
  }

  async onConfigChange(event: { key: string; value: unknown }) {
    switch (event.key) {
      case 'provider':
        this.model = models[event.value as keyof typeof models](
          this.config.get('model') === 'default'
            ? undefined
            : this.config.get('model'),
        ) as LanguageModel;
        break;
      case 'model':
        if (!Object.keys(models).includes(this.config.get('provider'))) {
          if (event.value === 'default') {
            return;
          }
          await this.config.set('model', 'default');
          throw new Error(
            `${this.config.get('provider')} does not support custom models`,
          );
        }
        try {
          this.model = models[this.config.get('provider')](
            event.value === 'default' ? undefined : (event.value as string),
          ) as LanguageModel;
        } catch (error) {
          throw new Error(
            `Invalid model, please ensure your name is correct: ${error as string}`,
          );
        }
        break;
      default:
        break;
    }
  }

  async ensureCollectionName(prompt: string): Promise<void> {
    if (!this.session.collection) {
      // Try to get the collection name from the current database if there's only one
      const collections = await this.cliContext.db.getCollectionNames();
      if (collections.length === 1) {
        this.session.collection = collections[0];
        this.respond(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Active collection set to ${chalk.blue(this.session.collection)}. Use ${chalk.yellow('ai.collection')} to set a different collection.`,
        );
      } else {
        const response = await this.getResponseFromModel(
          [{ role: 'user', content: "User's prompt: " + prompt }],
          {
            systemPrompt:
              "A user prompted about something which is likely related to a collection. You pick the collection that clearly matches the user's request. The collections to you have access to are: " +
              collections.join('; ') +
              ". If there is no clear match or if no collection is needed, return 'none'. Otherwise, return the collection name. Output only the collection name and nothing else, without formatting.",
            signal: AbortSignal.timeout(30_000),
          },
        );
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

  collection(prompt: string | undefined): void {
    this.session.collection = prompt;
    this.respond(`Active collection set to ${chalk.blue(prompt ?? 'none')}`);
  }

  async aggregate(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    await this.ensureCollectionName(prompt);

    await this.processResponse(prompt, {
      systemPrompt: await this.getSystemPrompt(
        "You generate the exact mongosh aggregate command that matches the user's request",
        { includeSampleDocs: true },
      ),
      signal,
      expectedOutput: 'command',
    });
  }

  async shell(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);

    await this.processResponse(prompt, {
      systemPrompt: await this.getSystemPrompt(
        "You generate a runnable mongosh command that matches the user's request",
        { includeSampleDocs: true },
      ),
      signal,
      expectedOutput: 'command',
    });
  }

  async query(prompt: string): Promise<void> {
    const signal = AbortSignal.timeout(30_000);
    await this.ensureCollectionName(prompt);

    await this.processResponse(prompt, {
      systemPrompt: await this.getSystemPrompt(
        "You generate the exact valid mongosh command that matches the user's request.",
        { includeSampleDocs: true },
      ),
      signal,
      expectedOutput: 'command',
    });
  }

  private formatResponse({
    response,
    expectedOutput,
  }: {
    response: string;
    expectedOutput: GetResponseOptions['expectedOutput'];
  }): string {
    if (expectedOutput === 'command') {
      // Often the models will return a command in a markdown code block, which we don't want
      return response
        .replace(/```\w*/g, '')
        .replace(/```/g, '')
        .trim();
    }

    return response;
  }

  async getResponseFromModel(
    messages: ModelMessage[],
    { systemPrompt, signal }: Omit<GetResponseOptions, 'expectedOutput'>,
  ): Promise<string> {
    // Use streaming for docs provider, generateText for others
    if (this.activeProvider === 'docs') {
      const result = streamText({
        model: this.model,
        messages: messages,
        system: systemPrompt,
        abortSignal: signal ?? AbortSignal.timeout(30_000),
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }
      return fullText;
    } else {
      const { text } = await generateText({
        model: this.model,

        messages: messages,
        system: systemPrompt,
        abortSignal: signal ?? AbortSignal.timeout(30_000),
      });
      return text;
    }
  }

  async processResponse(
    prompt: string,
    {
      systemPrompt,
      signal = AbortSignal.timeout(30_000),
      expectedOutput,
    }: GetResponseOptions,
  ): Promise<void> {
    this.thinking.start(signal);
    this.session.messages.push({ role: 'user', content: prompt });

    try {
      let text: string;

      // Use streaming for docs provider, generateText for others
      if (this.activeProvider === 'docs') {
        const result = streamText({
          model: this.model,
          messages: this.session.messages,
          system: systemPrompt,
          abortSignal: signal,
        });

        text = '';
        for await (const chunk of result.textStream) {
          text += chunk;
        }
      } else {
        const result = await generateText({
          model: this.model,
          messages: this.session.messages,
          system: systemPrompt,
          abortSignal: signal,
        });
        text = result.text;
      }

      this.session.messages.push({
        role: 'assistant',
        content: text,
      });

      switch (expectedOutput) {
        case 'command':
          this.setInput(
            this.formatResponse({ response: text, expectedOutput: 'response' }),
          );
          break;
        case 'response':
          this.respond(
            this.formatResponse({ response: text, expectedOutput: 'response' }),
          );
          break;
      }
    } catch (error) {
      throw new Error(`Error generating text: ${JSON.stringify(error)}`);
    } finally {
      this.session.messages.pop();
      this.thinking.stop();
    }
  }

  public clear() {
    this.session = {
      collection: this.config.get('defaultCollection'),
      messages: [],
    };
    this.respond('Session cleared');
  }
}
