import chalk from 'chalk';
import EventEmitter from 'events';
import { inspect } from 'util';
import { z, type z as ZodType } from 'zod';

const configSchema = z.object({
  provider: z.enum(['docs', 'openai', 'mistral', 'ollama']),
  model: z.string(),
  includeSampleDocs: z.boolean(),
  defaultCollection: z.string().optional(),
});

const configKeys = Object.keys(configSchema.shape) as Array<keyof ConfigSchema>;

export type ConfigSchema = ZodType.infer<typeof configSchema>;
type ConfigKeys = keyof ConfigSchema;

const defaults: Record<ConfigKeys, ConfigSchema[ConfigKeys]> = {
  provider: process.env.MONGOSH_AI_PROVIDER ?? 'docs',
  model: process.env.MONGOSH_AI_MODEL ?? 'default',
  includeSampleDocs: process.env.MONGOSH_AI_INCLUDE_SAMPLE_DOCS ?? false,
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
  private configMap: Record<ConfigKeys, ConfigSchema[ConfigKeys]> = defaults;

  private constructor(
    private readonly replConfig: {
      set: (key: string, value: unknown) => Promise<void>;
      get: <T>(key: string) => Promise<T>;
    },
  ) {
    super();
  }

  static async create(replConfig: {
    set: (key: string, value: unknown) => Promise<void>;
    get: <T>(key: string) => Promise<T>;
  }): Promise<Config> {
    const config = new Config(replConfig);
    const keys = Object.keys(configSchema.shape) as Array<keyof ConfigSchema>;
    for (const key of keys) {
      config.configMap[key] ??= await replConfig.get(key);
    }
    return config;
  }

  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K] {
    this.assertKey(key);
    return this.configMap[key] as ConfigSchema[K];
  }

  assertKey(key: string): asserts key is ConfigKeys {
    if (!configKeys.includes(key as ConfigKeys)) {
      throw new Error(
        `Invalid config key: ${key}. Valid keys are: ${configKeys.join(', ')}.`,
      );
    }
  }

  async set(key: ConfigKeys, value: ConfigSchema[ConfigKeys]): Promise<void> {
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
      if ('values' in schema.def) {
        type = `${(schema.def.values as string[]).join(' | ')}`;
      }
      const i = (value: unknown) => inspect(value, { colors: true });

      return `  ${i(key)}: ${chalk.white(i(this.configMap[key as ConfigKeys]))},${type ? chalk.gray(` // ${type}`) : ''}`;
    });

    return `{\n${lines.join('\n')}\n}`;
  }
}
