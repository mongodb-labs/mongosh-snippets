type CliContext = {
  db: {
    _mongo: {
      _instanceState: {
        evaluationListener: {
          setConfig: (key: string, value: unknown) => void;
          getConfig: <T>(key: string) => Promise<T>;
        };
        shellApi: Record<string, unknown>;
        context: Record<string, unknown>;
      };
    };
  };
};

module.exports = async (globalThis: CliContext) => {
  const logRequests = process.env.DEBUG_AGENT_REQUESTS === '1';
  const debugLogging = process.env.DEBUG_AGENT === '1';

  if (debugLogging) {
    process.stderr.write(`[agent] DEBUG_AGENT_REQUESTS=${process.env.DEBUG_AGENT_REQUESTS ?? 'undefined'}\n`);
  }

  if (logRequests) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalFetch = (globalThis as any).fetch;
    if (originalFetch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method || 'GET';
        process.stderr.write(`[agent:fetch] ${method} ${url}\n`);
        const start = Date.now();
        try {
          const response = await originalFetch(input, init);
          process.stderr.write(`[agent:fetch] Response: ${response.status} (${Date.now() - start}ms)\n`);
          return response;
        } catch (err) {
          process.stderr.write(`[agent:fetch] Error: ${err}\n`);
          throw err;
        }
      };
    }
  }

  const {
    createAgentSessionRuntime,
    createAgentSessionServices,
    createAgentSessionFromServices,
    SessionManager,
    InteractiveMode,
    SettingsManager,
    getAgentDir,
    initTheme,
  } = await import('@earendil-works/pi-coding-agent');

  // Initialize default dark theme
  initTheme('dark', false);

  // Create settings with quiet startup to hide pi branding
  const settingsManager = SettingsManager.inMemory({
    quietStartup: true,
  });

  // Suppress Kitty keyboard protocol query sequences by intercepting stdout.write
  // The sequence "\x1b[?u" triggers terminal responses that can leak as "3u"
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  let suppressKittyQueries = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
    if (suppressKittyQueries) {
      const str = typeof chunk === 'string' ? chunk : chunk.toString();
      // Filter out Kitty protocol query and enable sequences
      if (str.includes('\x1b[?u') || str.includes('\x1b[>7u') || str.includes('\x1b[>4;2m')) {
        if (debugLogging) {
          process.stderr.write(`[agent] Suppressed Kitty sequence: ${str}\n`);
        }
        // Call callback immediately to avoid hanging
        if (typeof callback === 'function') {
          callback();
        }
        return true;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalStdoutWrite as any)(chunk, encoding, callback);
  };

  class Agent {
    private sessionManager: ReturnType<typeof SessionManager.create>;

    constructor({ sessionManager }: { sessionManager: ReturnType<typeof SessionManager.create> }) {
      this.sessionManager = sessionManager;
    }

    static create(): Agent {
      const sessionManager = SessionManager.create(process.cwd());
      return new Agent({ sessionManager });
    }

    async run(): Promise<void> {
      // Detach mongosh's stdin listeners so TUI can own stdin
      const savedListeners = process.stdin.rawListeners('data') as ((...args: unknown[]) => void)[];
      process.stdin.removeAllListeners('data');
      process.stdin.pause();

      // Intercept process.exit so /quit and Ctrl+D return to mongosh
      const originalExit = process.exit;

      try {
        // Create the runtime factory for InteractiveMode
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createRuntime = async (options: any) => {
          const services = await createAgentSessionServices({ cwd: options.cwd, settingsManager });
          return {
            ...(await createAgentSessionFromServices({
              services,
              sessionManager: options.sessionManager,
              sessionStartEvent: options.sessionStartEvent,
            })),
            services,
            diagnostics: services.diagnostics,
          };
        };

        // Create the runtime
        const runtime = await createAgentSessionRuntime(createRuntime, {
          cwd: process.cwd(),
          agentDir: getAgentDir(),
          sessionManager: this.sessionManager,
        });

        // Create InteractiveMode
        const mode = new InteractiveMode(runtime, {
          migratedProviders: [],
          initialImages: [],
          initialMessages: [],
          verbose: debugLogging,
        });

        // Enable Kitty sequence suppression during TUI initialization
        suppressKittyQueries = true;

        // Print MongoDB leaf welcome banner before TUI takes over
        const chalk = await import('chalk');
        const g = chalk.default.green;
        const w = chalk.default.white.bold;
        const dim = chalk.default.gray;

        process.stdout.write('\n');
        process.stdout.write(`    ${g('       .    ')}\n`);
        process.stdout.write(`    ${g('      /|\\  ')}            ${w('mongosh')}\n`);
        process.stdout.write(`    ${g('     / | \\ ')}       ${g('▄▄▄    ▄▄▄▄   ▄▄▄▄  ▄ ▄▄▄  ▄▄█▄▄')}\n`);
        process.stdout.write(`    ${g('    /  |  \\')}      ${g('▀   █  █▀ ▀█  █▀  █  █▀  █    █')}\n`);
        process.stdout.write(`    ${g('   |  |||  |')}     ${g('▄▀▀▀█  █   █  █▀▀▀▀  █   █    █')}\n`);
        process.stdout.write(`    ${g('    \\ ||| /')}      ${g('▀▄▄▀█  ▀█▄▀█  ▀█▄▄▀  █   █    ▀▄▄')}\n`);
        process.stdout.write(`    ${g('     \\|||/ ')}       ${g('       ▄  █')}\n`);
        process.stdout.write(`    ${g('      |||   ')}      ${g('        ▀▀')}\n`);
        process.stdout.write(`\n`);
        process.stdout.write(dim('  Type your prompts below. Enter to send, Alt+Enter for new line, /quit to quit.') + '\n\n');

        // Wrap mode.run() in a promise that resolves when process.exit is called
        // InteractiveMode.run() has a while(true) loop that only breaks via process.exit()
        await new Promise<void>((resolve) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          process.exit = (() => {
            resolve();
          }) as any;

          mode.run().catch(() => {
            resolve();
          });
        });

        // Disable suppression after run completes
        suppressKittyQueries = false;

      } catch (err) {
        if (debugLogging) {
          process.stderr.write(`[agent] Error: ${err}\n`);
        }
      } finally {
        process.exit = originalExit;
        // Restore mongosh's stdin listeners
        for (const listener of savedListeners) {
          process.stdin.on('data', listener);
        }
        process.stdin.resume();
        process.stdout.write('\n[Exited agent mode]\n');
      }
    }
  }

  const agent = Agent.create();

  // Register "agent" as a direct shell command
  const instanceState = globalThis.db._mongo._instanceState;

  const agentFn = async () => {
    await agent.run();
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (agentFn as any).isDirectShellCommand = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (agentFn as any).returnsPromise = true;

  instanceState.shellApi['agent'] = agentFn;
  instanceState.context['agent'] = agentFn;
};
