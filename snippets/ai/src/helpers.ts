const _localRequire = require('module').createRequire(__filename);
const localRequire = <T>(module: string): T => _localRequire(module);

const chalk = localRequire<typeof import('chalk')>('chalk');
const process = localRequire<typeof import('process')>('process');

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
    _mongo: {
      _instanceState: {
        evaluationListener: {
          setConfig: (key: string, value: any) => Promise<void>;
          getConfig: <T>(key: string) => Promise<T>;
        };
        registerPlugin: (plugin: any) => void;
        shellApi: Record<string, any>;
        context: Record<string, any>;
      };
    };
  };
}

export function wrapFunction(
  cliContext: CliContext,
  instance: any,
  name: string | undefined,
  fn: Function,
) {
  const wrapperFn = (...args: string[]) => {
    return Object.assign(fn(...args), {
      [Symbol.for('@@mongosh.syntheticPromise')]: true,
    });
  };
  wrapperFn.isDirectShellCommand = true;
  wrapperFn.returnsPromise = true;

  const instanceState = cliContext.db._mongo._instanceState;

  instanceState.shellApi[name ? `ai.${name}` : 'ai'] = instanceState.context[
    name ? `ai.${name}` : 'ai'
  ] = wrapperFn;
}

export function wrapAllFunctions(cliContext: CliContext, instance: any) {
  const instanceState = cliContext.db._mongo._instanceState;
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
    if (typeof method === 'function' && method.isDirectShellCommand) {
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
      const base = `  ${chalk.yellow(c.cmd)}${padding} ${chalk.white(c.desc)}`;
      return c.example ? `${base} ${chalk.gray(`| ${c.example}`)}` : base;
    })
    .join('\n');

  return `${chalk.blue.bold('AI command suite for mongosh')}
${chalk.gray(`Collection: ${chalk.white.bold(collection ?? 'not set')}. Set it with ai.collection("collection_name")`)}\n
${formattedCommands}\n
${chalk.gray(`Using ${chalk.white.bold(provider)} as provider and its ${chalk.white.bold(model)} model`)}
  `.trim();
}
