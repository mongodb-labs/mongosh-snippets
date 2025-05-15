import { aiCommand } from './decorators';
import { AiProvider, EmptyAiProvider } from './providers/ai-provider';
import { getAtlasAiProvider } from './providers/atlas/atlas-ai-provider';
import { getDocsAiProvider } from './providers/docs/docs-ai-provider';
import {
  getAiSdkProvider,
  models,
} from './providers/generic/ai-sdk-provider';
import { Config, ConfigSchema } from './config';
import { CliContext, wrapAllFunctions, formatHelpCommands } from './helpers';

class AI {
  private readonly replConfig: {
    set: (key: string, value: any) => Promise<void>;
    get: <T>(key: string) => Promise<T>;
  };

  private ai: AiProvider;
  public config: Config;

  constructor(private readonly cliContext: CliContext) {
    const instanceState = this.cliContext.db._mongo._instanceState;

    this.replConfig = {
      set: (key, value) =>
        instanceState.evaluationListener.setConfig(`snippet_ai_${key}`, value),
      get: (key) =>
        instanceState.evaluationListener.getConfig(`snippet_ai_${key}`),
    };

    this.config = new Config(this.replConfig);

    // Set up provider change listener
    this.config.on('change', (event) => {
      switch (event.key) {
        case 'provider':
          this.ai = this.getProvider(event.value as ConfigSchema['provider']);
          break;
        case 'model':
          if (Object.keys(models).includes(event.value)) {
            this.ai = getAiSdkProvider(
              models[this.config.get('provider') as keyof typeof models](
                event.value,
              ),
              this.cliContext,
            );
          } else {
            throw new Error(`Invalid model: ${event.value}`);
          }
          break;
        default:
          break;
      }
    });

    this.ai = this.getProvider(process.env.MONGOSH_AI_PROVIDER as ConfigSchema['provider'] | undefined);
    wrapAllFunctions(this.cliContext, this);

    this.setupConfig();
  }

  async setupConfig() {
    await this.config.setup();

    this.ai = this.getProvider(this.config.get('provider'));
  }

  private getProvider(provider: ConfigSchema['provider'] | undefined): AiProvider {
    switch (provider) {
      case 'docs':
        return getDocsAiProvider(this.cliContext);
      case 'atlas':
        return getAtlasAiProvider(this.cliContext);
      case 'openai':
      case 'mistral':
      case 'ollama':
        const model = this.config.get('model');
        return getAiSdkProvider(
          models[provider](model === 'default' ? undefined : model),
          this.cliContext,
        );
      default:
        return new EmptyAiProvider(this.cliContext);
    }
  }

  @aiCommand
  async command(prompt: string) {
    await this.ai.command(prompt);
  }

  @aiCommand
  async query(prompt: string) {
    await this.ai.query(prompt);
  }

  @aiCommand
  async ask(prompt: string) {
    await this.ai.ask(prompt);
  }

  @aiCommand
  async aggregate(prompt: string) {
    await this.ai.aggregate(prompt);
  }

  @aiCommand
  async help(...args: string[]) {
    const commands = [
      { cmd: 'ai.ask', desc: 'ask questions', example: 'ai.ask how do I run queries in mongosh?' },
      { cmd: 'ai.command', desc: 'generate any mongosh command', example: 'ai.command create a new database' },
      { cmd: 'ai.query', desc: 'generate a MongoDB query', example: 'ai.query find documents where name = "Ada"' },
      { cmd: 'ai.aggregate', desc: 'generate a MongoDB aggregation', example: 'ai.aggregate find documents where name = "Ada"' },
      { cmd: 'ai.config', desc: 'configure the AI commands', example: 'ai.config.set("provider", "ollama")' }
    ];

    this.ai.respond(
      formatHelpCommands(
        commands,
        this.config.get('provider'),
        this.config.get('model')
      )
    );
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    this.ai.help();
    return '';
  }
}

module.exports = (globalThis: any) => {
  globalThis.ai = new AI(globalThis);
};
