import { AiProvider } from './providers/ai-provider.js';
import { Config } from './config.js';
import {
  formatHelpCommands,
  wrapAllFunctions,
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

    @aiCommand()
    async command(prompt: string) {
      await this.ai.shell(prompt);
    }

    @aiCommand()
    async cmd(prompt: string) {
      await this.command(prompt);
    }

    @aiCommand()
    async find(prompt: string) {
      await this.ai.aggregate(prompt);
    }

    @aiCommand()
    async ask(prompt: string) {
      await this.ai.processResponse(prompt, {
        systemPrompt:
          'You are a MongoDB and mongosh expert. Give brief answers without any formatting.',
        expectedOutput: 'response',
      });
    }

    @aiCommand({ requiresPrompt: false })
    help() {
      const commands = [
        {
          cmd: 'ai.ask',
          desc: 'ask MongoDB questions',
          example: 'ai.ask how do I run queries in mongosh?',
        },
        {
          cmd: 'ai.find',
          desc: 'generate a MongoDB query or aggregation',
          example: 'ai.find documents where name = "Ada"',
        },
        {
          cmd: 'ai.collection',
          desc: 'set the active collection',
          example: 'ai.collection users',
        },
        {
          cmd: 'ai.command',
          desc: `Generate mongosh commands`,
          example: 'ai.command insert a new sample document | alias: ai.cmd',
        },
        {
          cmd: 'ai.config',
          desc: 'configure the AI commands',
          example: 'ai.config.set("provider", "ollama")',
        },
      ];

      this.ai.respond(
        formatHelpCommands(commands, {
          provider: this.config.get('provider'),
          model: this.config.get('model'),
          collection: this.ai.activeCollection,
        }),
      );
    }

    @aiCommand()
    clear() {
      this.ai.clear();
    }

    @aiCommand()
    collection(name: string) {
      this.ai.collection(name);
    }

    @aiCommand()
    async provider(provider: string) {
      await this.config.set('provider', provider);
      this.ai.respond(`Switched to ${chalk.blue(provider)} provider`);
    }

    @aiCommand()
    async model(model: string) {
      await this.config.set('model', model);
      this.ai.respond(`Switched to ${chalk.blue(model)} model`);
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
