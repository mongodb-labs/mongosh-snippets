import chalk from 'chalk';

export function output(text: string) {
  process.stdout.write(`${text}`);
}

export class LoadingAnimation {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private i = 0;
  private interval: NodeJS.Timeout | null = null;
  private abortListener: (() => void) | null = null;
  private message: string;
  private signal: AbortSignal | null = null;

  constructor({ message = 'Loading' }: { message?: string }) {
    this.message = message;
  }

  public get isRunning(): boolean {
    return this.interval !== null;
  }

  start(signal: AbortSignal): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      const frame = this.frames[(this.i = ++this.i % this.frames.length)];
      process.stdout.write(chalk.blue(`\r${frame} ${this.message}`));
    }, 80);

    this.abortListener = () => {
      this.stop();
    };

    signal.addEventListener('abort', this.abortListener, { once: true });
  }

  stop(): void {
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener('abort', this.abortListener);
      this.abortListener = null;
    }

    if (this.interval) {
      clearInterval(this.interval);
      process.stdout.write('\r\x1b[K'); // Clear the line
      this.interval = null;
    }
  }
}

export interface CliContext {
  ai: unknown;
  db: {
    _name: string;
    getCollectionNames: () => Promise<string[]>;
    getCollection: (name: string) => {
      aggregate: (pipeline: unknown[]) => Promise<{
        toArray: () => Promise<Record<string, unknown>[]>;
      }>;
    };
    _mongo: {
      _instanceState: {
        evaluationListener: {
          setConfig: (key: string, value: unknown) => Promise<void>;
          getConfig: <T>(key: string) => Promise<T>;
        };
        registerPlugin: (plugin: unknown) => void;
        shellApi: Record<string, unknown>;
        context: Record<string, unknown>;
      };
    };
  };
}

export function wrapFunction(
  cliContext: CliContext,
  instance: unknown,
  name: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fn: (..._args: unknown[]) => Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wrapperFn = (..._args: unknown[]) => {
    return fn(..._args);
  };
  wrapperFn.isDirectShellCommand = true;
  wrapperFn.returnsPromise = true;

  const instanceState = cliContext.db._mongo._instanceState;

  instanceState.shellApi[name ? `ai.${name}` : 'ai'] = instanceState.context[
    name ? `ai.${name}` : 'ai'
  ] = wrapperFn;
}

export function wrapAllFunctions(
  cliContext: CliContext,
  currentInstance: unknown,
) {
  const instanceState = cliContext.db._mongo._instanceState;
  const instance = currentInstance as {
    [key: string]: (...args: unknown[]) =>
      | Record<string, unknown>
      | {
          isDirectShellCommand: boolean;
        };
  };

  const methods = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(instance),
      name,
    );
    return (
      descriptor &&
      typeof descriptor.value === 'function' &&
      name !== 'constructor'
    );
  });

  // for all methods, wrap them with the wrapFunction method
  for (const methodName of methods) {
    const method = instance[methodName];
    if (
      typeof method === 'function' &&
      (method as unknown as { isDirectShellCommand: boolean })
        .isDirectShellCommand
    ) {
      wrapFunction(cliContext, instance, methodName, method.bind(instance));
    }
  }
  instanceState.registerPlugin(instance);

  wrapFunction(cliContext, instance, undefined, instance.help.bind(instance));
}

interface HelpCommand {
  cmd: string;
  desc: string;
  example?: string;
}

export function formatHelpCommands(
  commands: HelpCommand[],
  {
    provider,
    model,
    collection,
  }: { provider: string; model: string; collection?: string },
): string {
  const maxCmdLength = Math.max(...commands.map((c) => c.cmd.length));
  const formattedCommands = commands
    .map((c) => {
      const padding = ' '.repeat(maxCmdLength - c.cmd.length);
      const base = `  ${chalk.cyan(c.cmd)}${padding} ${chalk.white(c.desc)}`;
      return c.example ? `${base} ${chalk.gray(`| ${c.example}`)}` : base;
    })
    .join('\n');

  return `${chalk.cyan.bold('mongosh AI snippet')}
${chalk.yellow.bold('Note: This snippet is experimental and not meant for production use.')}
${chalk.gray(`Collection: ${chalk.white.bold(collection ?? 'not set')}. Set it with ${chalk.white.bold('ai.collection("collection_name")')}`)}\n
${formattedCommands}\n
${chalk.gray(`Using ${chalk.white.bold(provider)} as provider and its ${chalk.white.bold(model)} model`)}
  `.trim();
}
