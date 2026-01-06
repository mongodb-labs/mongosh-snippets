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
  fn: (..._args: unknown[]) => unknown,
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

export interface CommandMetadata {
  isDirectShellCommand: boolean;
  alias?: string;
  description: string;
  example: string;
  hidden?: boolean;
}

export function getCommandMetadata(
  instance: unknown,
): Map<string, CommandMetadata> {
  const metadata = new Map<string, CommandMetadata>();
  const instanceObj = instance as {
    [key: string]: unknown;
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

  for (const methodName of methods) {
    const method = instanceObj[methodName];
    const methodWithMeta = method as {
      isDirectShellCommand?: boolean;
      alias?: string;
      description?: string;
      example?: string;
      hidden?: boolean;
    };

    if (
      typeof method === 'function' &&
      methodWithMeta.isDirectShellCommand &&
      methodWithMeta.description &&
      methodWithMeta.example
    ) {
      metadata.set(methodName, {
        isDirectShellCommand: methodWithMeta.isDirectShellCommand,
        alias: methodWithMeta.alias,
        description: methodWithMeta.description,
        example: methodWithMeta.example,
        hidden: methodWithMeta.hidden,
      });
    }
  }

  return metadata;
}

export function wrapAllFunctions(
  cliContext: CliContext,
  currentInstance: unknown,
) {
  const instanceState = cliContext.db._mongo._instanceState;
  const instance = currentInstance as {
    [key: string]: unknown;
    askOrHelp: (...args: unknown[]) => unknown;
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
    const methodWithMeta = method as {
      isDirectShellCommand?: boolean;
      alias?: string;
    };

    if (typeof method === 'function' && methodWithMeta.isDirectShellCommand) {
      wrapFunction(
        cliContext,
        instance,
        methodName,
        (method as (...args: unknown[]) => unknown).bind(instance),
      );

      // Register alias if one is specified
      const alias = methodWithMeta.alias;
      if (alias) {
        wrapFunction(
          cliContext,
          instance,
          alias,
          (method as (...args: unknown[]) => unknown).bind(instance),
        );
      }
    }
  }
  instanceState.registerPlugin(instance);

  wrapFunction(
    cliContext,
    instance,
    undefined,
    instance.askOrHelp.bind(instance),
  );
}

interface HelpCommand {
  cmd: string;
  desc: string;
  example?: string;
  highlight?: boolean;
}

export function buildHelpCommands(
  metadata: Map<string, CommandMetadata>,
  highlightCommands: string[] = ['find', 'cmd'],
): HelpCommand[] {
  const commands: HelpCommand[] = [
    // Add the special "ai" shortcut command first
    {
      cmd: 'ai <question>',
      desc: 'Ask MongoDB questions',
      example: 'ai how do I run queries in mongosh?',
      highlight: true,
    },
  ];

  // Extract commands from metadata, prioritizing certain commands
  const priorityOrder = [
    'find',
    'cmd',
    'ask',
    'collection',
    'provider',
    'model',
    'clear',
  ];

  for (const methodName of priorityOrder) {
    const meta = metadata.get(methodName);
    if (meta && !meta.hidden) {
      commands.push({
        cmd: `ai.${methodName}`,
        desc: meta.description,
        example: meta.example,
        highlight: highlightCommands.includes(methodName),
      });
    }
  }

  // Add any remaining commands not in priority list
  for (const [methodName, meta] of metadata) {
    if (
      !priorityOrder.includes(methodName) &&
      methodName !== 'help' &&
      !meta.hidden
    ) {
      commands.push({
        cmd: `ai.${methodName}`,
        desc: meta.description,
        example: meta.example,
        highlight: highlightCommands.includes(methodName),
      });
    }
  }

  // Add config command manually (it's an object, not a decorated method)
  commands.push({
    cmd: 'ai.config',
    desc: 'Configure the AI commands',
    example: 'ai.config.set("provider", "ollama")',
    highlight: false,
  });

  return commands;
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
  const maxDescLength = Math.max(...commands.map((c) => c.desc.length));
  const formattedCommands = commands
    .map((c) => {
      const cmdPadding = ' '.repeat(maxCmdLength - c.cmd.length + 2);
      const base = `  ${c.highlight ? chalk.cyan(c.cmd) : chalk.white.bold(c.cmd)}${cmdPadding} ${chalk.white(c.desc)}`;
      if (c.example) {
        const descPadding = ' '.repeat(maxDescLength - c.desc.length + 2);
        return `${base}${descPadding}${chalk.gray(`${c.example}`)}`;
      }
      return base;
    })
    .join('\n');

  return `${chalk.cyan.yellow('mongosh AI snippet (experimental)')}
${chalk.gray(`Collection: ${chalk.white.bold(collection ?? 'not set')}. Set it with ${chalk.white.bold('ai.collection("collection_name")')}`)}\n
${formattedCommands}\n
${chalk.gray(`Using ${chalk.white.bold(provider)} as provider and its ${chalk.white.bold(model)} model`)}
  `.trim();
}
