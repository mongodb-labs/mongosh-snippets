import { aiCommand } from './decorators';
import { AiProvider, EmptyAiProvider } from './providers/ai-provider';
import { getAtlasAiProvider } from './providers/atlas/atlas-ai-provider';
import { getDocsAiProvider } from './providers/docs/docs-ai-provider';
import { getAiSdkProvider, models } from './providers/generic/ai-sdk-provider';
import { Config, ConfigSchema } from './config';
import { CliContext, wrapAllFunctions } from './helpers';
import chalk from 'chalk';

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
    this.config.on('change', async (event) => {
      switch (event.key) {
        case 'provider':
          this.ai = this.getProvider(event.value as ConfigSchema['provider']);
          break;
        case 'model':
            if (!Object.keys(models).includes(this.config.get('provider') as keyof typeof models)) {
              if (event.value == 'default') {
                return;
              }
              await this.config.set('model', 'default');
              throw new Error(`${this.config.get('provider')} does not support custom models`);
            }
          try {
            this.ai = getAiSdkProvider(
              models[this.config.get('provider') as keyof typeof models](
                event.value == 'default' ? undefined : event.value as string,
              ),
              this.cliContext,
              this.config,
            );
          } catch (error) {
            throw new Error(`Invalid model, please ensure your name is correct: ${error}`);
          }
          break;
        default:
          break;
      }
    });

    this.ai = this.getProvider(
      process.env.MONGOSH_AI_PROVIDER as ConfigSchema['provider'] | undefined,
    );
    wrapAllFunctions(this.cliContext, this);

    this.setupConfig();
  }

  async setupConfig() {
    await this.config.setup();

    this.ai = this.getProvider(this.config.get('provider'));
  }

  private getProvider(
    provider: ConfigSchema['provider'] | undefined,
  ): AiProvider {
    switch (provider) {
      case 'docs':
        return getDocsAiProvider(this.cliContext, this.config);
      case 'atlas':
        return getAtlasAiProvider(this.cliContext, this.config);
      case 'openai':
      case 'mistral':
      case 'ollama':
        const model = this.config.get('model');
        return getAiSdkProvider(
          models[provider](model === 'default' ? undefined : model),
          this.cliContext,
          this.config,
        );
      default:
        return new EmptyAiProvider(this.cliContext, this.config);
    }
  }

  @aiCommand()
  async shell(prompt: string) {
    await this.ai.shell(prompt);
  }

  @aiCommand()
  async general(prompt: string) {
    await this.ai.general(prompt);
  }

  @aiCommand()
  async data(prompt: string) {
    await this.ai.data(prompt);
  }

  @aiCommand()
  async query(prompt: string) {
    await this.ai.query(prompt);
  }

  @aiCommand()
  async ask(prompt: string) {
    await this.ai.ask(prompt);
  }

  @aiCommand()
  async aggregate(prompt: string) {
    await this.ai.aggregate(prompt);
  }

  @aiCommand({requiresPrompt: false})
  async help() {
    this.ai.help({
      provider: this.config.get('provider'),
      model: this.config.get('model'),
    });
  }

  @aiCommand()
  async clear() {
    this.ai.clear();
  }

  @aiCommand()
  async collection(name: string) {
    await this.ai.collection(name);
  }

  @aiCommand()
  async provider(provider: string) {
    this.config.set('provider', provider);
    this.ai.respond(`Switched to ${chalk.blue(provider)} provider`);
  }

  @aiCommand()
  async model(model: string) {
    this.config.set('model', model);
    this.ai.respond(`Switched to ${chalk.blue(model)} model`);
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    this.help();
    return '';
  }
}

module.exports = (globalThis: any) => {
  globalThis.ai = new AI(globalThis);
};
