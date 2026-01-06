import { AiProvider } from './providers/ai-provider.js';
import { Config } from './config.js';
import {
  formatHelpCommands,
  wrapAllFunctions,
  getCommandMetadata,
  buildHelpCommands,
  type CliContext,
} from './helpers.js';
import { models } from './providers/models.js';
import { aiCommand } from './decorators.js';
import chalk from 'chalk';

module.exports = async (globalThis: CliContext) => {
  class AI {
    private readonly ai: AiProvider;
    public config: Config;

    constructor({ ai, config }: { ai: AiProvider; config: Config }) {
      this.ai = ai;
      this.config = config;
    }

    static async create(cliContext: CliContext): Promise<AI> {
      const instanceState = cliContext.db._mongo._instanceState;

      const replConfig = {
        set: (key: string, value: unknown) =>
          instanceState.evaluationListener.setConfig(
            `snippet_ai_${key}`,
            value,
          ),
        get: <T>(key: string): Promise<T> =>
          instanceState.evaluationListener.getConfig(`snippet_ai_${key}`),
      };

      const config = await Config.create(replConfig);

      const provider = new AiProvider(
        cliContext,
        config,
        models[config.get('provider')](
          config.get('model') === 'default' ? undefined : config.get('model'),
        ),
      );

      const ai = new AI({
        ai: provider,
        config,
      });

      wrapAllFunctions(cliContext, ai);
      return ai;
    }

    @aiCommand({
      alias: 'command',
      description: 'Generate mongosh commands',
      example: 'ai.cmd insert a new sample document',
    })
    async cmd(prompt: string) {
      await this.ai.shell(prompt);
    }

    @aiCommand({
      alias: 'query',
      description: 'Generate a query or aggregation',
      example: 'ai.find documents where name = "Ada"',
    })
    async find(prompt: string) {
      await this.ai.aggregate(prompt);
    }

    @aiCommand({
      description: 'Ask MongoDB questions',
      example: 'ai.ask how do I run queries in mongosh?',
      hidden: true,
    })
    async ask(prompt: string) {
      await this.ai.processResponse(prompt, {
        systemPrompt:
          'You are a MongoDB and mongosh expert. Give brief answers without any formatting.',
        expectedOutput: 'response',
      });
    }

    @aiCommand({
      prompt: 'none',
      description: 'Show help information',
      example: 'ai.help()',
      hidden: true,
    })
    help() {
      const metadata = getCommandMetadata(this);
      const commands = buildHelpCommands(metadata, ['find', 'cmd']);

      this.ai.respond(
        formatHelpCommands(commands, {
          provider: this.config.get('provider'),
          model: this.config.get('model'),
          collection: this.ai.activeCollection,
        }),
      );
    }

    @aiCommand({
      prompt: 'none',
      description: 'Clear the conversation history',
      example: 'ai.clear',
      alias: 'cls',
    })
    clear() {
      this.ai.clear();
    }

    @aiCommand({
      alias: 'coll',
      description: 'Set the active collection',
      example: 'ai.collection users',
    })
    collection(name: string) {
      this.ai.collection(name);
    }

    @aiCommand({
      description: 'Change the AI provider',
      example: 'ai.provider ollama',
      hidden: true,
    })
    async provider(provider: string) {
      await this.config.set('provider', provider);
      this.ai.respond(`Switched to ${chalk.blue(provider)} provider`);
    }

    @aiCommand({
      description: 'Change the AI model',
      example: 'ai.model gpt-4',
      hidden: true,
    })
    async model(model: string) {
      await this.config.set('model', model);
      this.ai.respond(`Switched to ${chalk.blue(model)} model`);
    }

    async askOrHelp(prompt?: string) {
      if (prompt) {
        await this.ask(prompt);
      } else {
        this.help();
      }
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
      this.help();
      return '';
    }
  }

  (globalThis as unknown as CliContext).ai = await AI.create(
    globalThis as unknown as CliContext,
  );
};
