import { AiProvider } from './providers/ai-provider';
import { EventEmitter } from 'events';
import { z } from 'zod';
import chalk from 'chalk';
import { inspect } from 'util';

const configSchema = z.object({
  provider: z.enum(['docs', 'openai', 'mistral', 'atlas', 'ollama']),
  model: z.string(),
  includeSampleDocs: z.boolean(),
  defaultCollection: z.string().optional(),
});

const configKeys = Object.keys(configSchema.shape) as Array<keyof ConfigSchema>;

export type ConfigSchema = z.infer<typeof configSchema>;
type ConfigKeys = keyof ConfigSchema;

const defaults: Record<ConfigKeys, any> = {
  provider: process.env.MONGOSH_AI_PROVIDER ?? 'docs',
  model: process.env.MONGOSH_AI_MODEL ?? 'default',
  includeSampleDocs: process.env.MONGOSH_AI_INCLUDE_SAMPLE_DOCS ?? true,
  defaultCollection: process.env.MONGOSH_AI_DEFAULT_COLLECTION,
};

export class Config extends EventEmitter<{
  change: [
    {
      key: ConfigKeys;
      value: ConfigSchema[ConfigKeys];
    },
  ];
}> {
  private configMap: Record<string, any> = {};

  constructor(
    private readonly replConfig: {
      set: (key: string, value: any) => Promise<void>;
      get: <T>(key: string) => Promise<T>;
    },
  ) {
    super();
  }

  async setup(): Promise<void> {
    const keys = Object.keys(configSchema.shape) as Array<keyof ConfigSchema>;
    for (const key of keys) {
      this.configMap[key] = (await this.replConfig.get(key)) ?? defaults[key];
    }
  }

  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    this.assertKey(key);
    return this.configMap[key];
  }

  assertKey(key: string): asserts key is ConfigKeys {
    if (!configKeys.includes(key as ConfigKeys)) {
      throw new Error(
        `Invalid config key: ${key}. Valid keys are: ${configKeys.join(', ')}.`,
      );
    }
  }

  async set(key: ConfigKeys, value: any): Promise<void> {
    this.assertKey(key);

    // Validate the value based on the key
    value = configSchema.shape[key].parse(value);

    await this.replConfig.set(key, value);
    this.configMap[key] = value;
    this.emit('change', { key, value });
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    const lines = Object.entries(configSchema.shape).map(([key, schema]) => {
      let type: string | undefined = undefined;
      if (schema._def.typeName === 'ZodEnum') {
        type = `${schema._def.values.join(' | ')}`;
      }
      const i = (value: any) => inspect(value, {colors: true});

      return `  ${i(key)}: ${chalk.white(i(this.configMap[key]))},${type ? chalk.gray(` // ${type}`) : ''}`;
    });

    return `{\n${lines.join('\n')}\n}`;
  }
}
