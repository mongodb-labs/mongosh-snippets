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
  // Enable request logging if DEBUG_AGENT_REQUESTS is set
  const logRequests = process.env.DEBUG_AGENT_REQUESTS === '1';
  const debugLogging = process.env.DEBUG_AGENT === '1';

  if (debugLogging) {
    process.stderr.write(`[agent] DEBUG_AGENT_REQUESTS=${process.env.DEBUG_AGENT_REQUESTS ?? 'undefined'}, logRequests=${logRequests ? 'true' : 'false'}\n`);
  }

  if (logRequests) {
    // Patch global fetch to log requests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalFetch = (globalThis as any).fetch;
    process.stderr.write(`[agent] originalFetch exists: ${originalFetch ? 'true' : 'false'}\n`);
    if (originalFetch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = async (input: any, init?: any) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method || 'GET';
        const body = init?.body;

        process.stderr.write(`[agent:fetch] ${method} ${url}\n`);
        if (body && typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            process.stderr.write(`[agent:fetch] Body: ${JSON.stringify(parsed, null, 2).substring(0, 500)}\n`);
          } catch {
            process.stderr.write(`[agent:fetch] Body: ${body.substring(0, 200)}...\n`);
          }
        }

        const start = Date.now();
        try {
          const response = await originalFetch(input, init);
          const duration = Date.now() - start;
          process.stderr.write(`[agent:fetch] Response: ${response.status} (${duration}ms)\n`);
          return response;
        } catch (err) {
          const duration = Date.now() - start;
          process.stderr.write(`[agent:fetch] Error after ${duration}ms: ${err}\n`);
          throw err;
        }
      };
    }
  }

  const {
    AuthStorage,
    createAgentSession,
    ModelRegistry,
    SessionManager,
  } = await import('@earendil-works/pi-coding-agent');

  const tuiMod = await import('@earendil-works/pi-tui');
  const TUI = tuiMod.TUI;
  const ProcessTerminal = tuiMod.ProcessTerminal;
  const Editor = tuiMod.Editor;
  const Loader = tuiMod.Loader;
  const TuiText = tuiMod.Text;
  const Spacer = tuiMod.Spacer;
  const Container = tuiMod.Container;
  const matchesKey = tuiMod.matchesKey;
  const Key = tuiMod.Key;

  // Import chalk for colors
  const { default: chalk } = await import('chalk');

  // Welcome banner: leaf on left, mongosh + agent on right
  const showWelcomeBanner = () => {
    const g = chalk.green;
    const w = chalk.white.bold;
    const dim = chalk.gray;

    // MongoDB leaf ASCII (left side) + mongosh text + agent big text (right side)
    // All aligned as a cohesive logo
    const lines = [
      `    ${g("       .    ")}`,
      `    ${g("      /|\\  ")}            ${w("mongosh")}`,
      `    ${g("     / | \\ ")}       ${g("▄▄▄    ▄▄▄▄   ▄▄▄▄  ▄ ▄▄▄  ▄▄█▄▄")}`,
      `    ${g("    /  |  \\")}      ${g("▀   █  █▀ ▀█  █▀  █  █▀  █    █")}`,
      `    ${g("   |  |||  |")}     ${g("▄▀▀▀█  █   █  █▀▀▀▀  █   █    █")}`,
      `    ${g("    \\ ||| /")}      ${g("▀▄▄▀█  ▀█▄▀█  ▀█▄▄▀  █   █    ▀▄▄")}`,
      `    ${g("     \\|||/ ")}       ${g("       ▄  █")}`,
      `    ${g("      |||   ")}      ${g("        ▀▀")}`,
      ``,
      dim('  Type your prompts below. Enter to send, Alt+Enter for new line, /exit to quit.'),
    ];

    return lines.join('\n');
  };

  // Minimal theme for the Editor (autocomplete select list colours) - MongoDB green
  const editorTheme = {
    borderColor: (s: string) => `\x1b[32m${s}\x1b[0m`,
    selectList: {
      selectedPrefix: (s: string) => `\x1b[32m${s}\x1b[0m`,
      selectedText: (s: string) => `\x1b[1m${s}\x1b[0m`,
      description: (s: string) => `\x1b[90m${s}\x1b[0m`,
      scrollInfo: (s: string) => `\x1b[90m${s}\x1b[0m`,
      noMatch: (s: string) => `\x1b[90m${s}\x1b[0m`,
    },
  };

  class Agent {
    private session: Awaited<ReturnType<typeof createAgentSession>>['session'];

    constructor({
      session,
    }: {
      session: Awaited<ReturnType<typeof createAgentSession>>['session'];
    }) {
      this.session = session;
    }

    static async create(): Promise<Agent> {
      const authStorage = AuthStorage.create();
      const modelRegistry = ModelRegistry.create(authStorage);

      const { session } = await createAgentSession({
        sessionManager: SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        cwd: process.cwd(),
      });

      return new Agent({ session });
    }

    async run(): Promise<void> {
      // Debug: check session state (only when DEBUG_AGENT=1)
      const debugLogging = process.env.DEBUG_AGENT === '1';
      if (debugLogging) {
        const model = this.session.model as any;
        process.stderr.write(`[agent] Starting agent mode\n`);
        process.stderr.write(`[agent] Session ID: ${this.session.sessionId}\n`);
        process.stderr.write(`[agent] Model: ${model?.id || 'none'}\n`);
        process.stderr.write(`[agent] Provider: ${model?.provider || 'none'}\n`);
        process.stderr.write(`[agent] API Key present: ${!!model?.apiKey}\n`);
        process.stderr.write(`[agent] Base URL: ${model?.baseUrl || 'default'}\n`);
      }

      // ------------------------------------------------------------------
      // Detach mongosh's stdin listeners so ProcessTerminal can own stdin
      // ------------------------------------------------------------------
      const savedListeners = process.stdin.rawListeners('data') as ((...args: unknown[]) => void)[];
      process.stdin.removeAllListeners('data');
      process.stdin.pause();

      const terminal = new ProcessTerminal();
      const tui = new TUI(terminal);

      // Chat history container (grows upward as messages are added)
      const history = new Container();
      tui.addChild(history);
      tui.addChild(new Spacer(1));

      // Welcome banner
      const bannerLines = showWelcomeBanner().split('\n');
      for (const line of bannerLines) {
        const bannerLine = new TuiText(line, 0, 0);
        history.addChild(bannerLine);
      }
      history.addChild(new Spacer(1));

      // Thinking spinner (hidden until a prompt is in flight)
      const loader = new Loader(
        tui,
        (s) => `\x1b[32m${s}\x1b[0m`,
        (s) => `\x1b[90m${s}\x1b[0m`,
        'Thinking…',
      );
      loader.stop();
      tui.addChild(loader);

      const editor = new Editor(tui, editorTheme, { paddingX: 1 });
      tui.addChild(editor);
      tui.setFocus(editor);

      // Start the TUI (takes over stdin, begins render loop)
      tui.start();

      // For accumulating the current AI response text
      type TuiTextInstance = InstanceType<typeof TuiText>;
      let responseText: TuiTextInstance | null = null;
      let isStreaming = false;

      const ensureResponseNode = () => {
        if (!isStreaming) {
          process.stderr.write(`[agent] Creating response node\n`);
          // Add a header for the AI response
          const header = new TuiText('\x1b[1m\x1b[32mAgent:\x1b[0m', 1, 0);
          history.addChild(header);
          responseText = new TuiText('', 1, 0);
          history.addChild(responseText);
          isStreaming = true;
          process.stderr.write(`[agent] Response node created\n`);
        }
      };

      type SessionEvent =
        | {
            type: 'message_update';
            assistantMessageEvent: { type: string; delta: string };
          }
        | { type: 'message_end' }
        | { type: 'message_start' }
        | { type: 'agent_start' }
        | { type: 'agent_end' }
        | { type: 'tool_execution_start'; toolName: string }
        | { type: 'tool_execution_end'; toolName: string; isError: boolean }
        | { type: 'error'; error?: string }
        | { type: 'auto_retry_start' }
        | { type: 'auto_retry_end' }
        | { type: string };

      // Track accumulated response text separately since Text has no public getter
      let responseBuffer = '';

      const unsubscribe = this.session.subscribe((event: SessionEvent) => {
        // Only log event types when DEBUG_AGENT=1
        if (debugLogging) {
          process.stderr.write(`[agent] event type: ${event.type}\n`);
        }

        if (
          event.type === 'message_update' &&
          'assistantMessageEvent' in event &&
          event.assistantMessageEvent.type === 'text_delta'
        ) {
          const delta = event.assistantMessageEvent.delta;
          ensureResponseNode();
          responseBuffer += delta;
          if (responseText) {
            responseText.setText(responseBuffer);
          }
          tui.requestRender();
        }

        if (event.type === 'message_end') {
          if (debugLogging) {
            process.stderr.write(`[agent] message_end received, buffer length: ${responseBuffer.length}\n`);
          }
          // If we got no text, the request likely failed
          if (responseBuffer.length === 0 && isStreaming) {
            if (debugLogging) {
              process.stderr.write(`[agent] WARNING: empty response received\n`);
            }
            if (responseText) {
              responseText.setText('\x1b[31mError: Request failed or returned empty response. Check your API key and model configuration.\x1b[0m');
            }
          }
          isStreaming = false;
          responseBuffer = '';
          responseText = null;
          loader.stop();
          editor.disableSubmit = false;
          // Add a spacer after the response for visual separation
          history.addChild(new Spacer(1));
          tui.requestRender();
        }

        if (event.type === 'agent_start' && debugLogging) {
          process.stderr.write(`[agent] agent_start - agent is processing\n`);
        }

        if (event.type === 'message_start' && debugLogging) {
          process.stderr.write(`[agent] message_start - response starting\n`);
        }

        if (event.type === 'tool_execution_start' && 'toolName' in event) {
          if (debugLogging) {
            process.stderr.write(`[agent] tool: ${event.toolName}\n`);
          }
          if (event.toolName !== 'read') {
            loader.setMessage(`Tool: ${event.toolName}…`);
            tui.requestRender();
          }
        }

        if (event.type === 'tool_execution_end' && 'toolName' in event && debugLogging) {
          process.stderr.write(`[agent] tool end: ${event.toolName} error=${event.isError}\n`);
        }

        if (event.type === 'agent_end' && debugLogging) {
          process.stderr.write(`[agent] agent_end - processing complete\n`);
        }

        // Handle error events from the session
        if (event.type === 'error') {
          if (debugLogging) {
            process.stderr.write(`[agent] error event\n`);
          }
          loader.stop();
          editor.disableSubmit = false;
          isStreaming = false;
          const errorText =
            'error' in event && typeof event.error === 'string'
              ? event.error
              : 'Unknown error';
          const errMsg = new TuiText(`\x1b[31mError: ${errorText}\x1b[0m`, 1, 0);
          history.addChild(errMsg);
          history.addChild(new Spacer(1));
          tui.requestRender();
        }

        // Handle retry events (API failures)
        if (event.type === 'auto_retry_start') {
          if (debugLogging) {
            process.stderr.write(`[agent] auto_retry_start\n`);
          }
          loader.setMessage('Retrying…');
          tui.requestRender();
        }

        if (event.type === 'auto_retry_end' && debugLogging) {
          process.stderr.write(`[agent] auto_retry_end\n`);
          // If retry failed, it will be followed by an error event
        }
      });

      // Promise that resolves when the user exits agent mode
      let exitError: Error | null = null;

      try {
        await new Promise<void>((resolve) => {
          // Ctrl+C aborts the current prompt; a second Ctrl+C exits
          let ctrlCCount = 0;

          tui.addInputListener((data) => {
            if (matchesKey(data, Key.ctrl('c'))) {
              ctrlCCount++;
              if (ctrlCCount === 1) {
                void this.session.abort();
                loader.stop();
                editor.disableSubmit = false;
                const hint = new TuiText(
                  '\x1b[90m(Press Ctrl+C again to exit agent mode)\x1b[0m',
                  1,
                  0,
                );
                history.addChild(hint);
                tui.requestRender();
                // Reset the double-press window after 2 s
                setTimeout(() => {
                  ctrlCCount = 0;
                }, 2000);
                return { consume: true };
              }
              // Second Ctrl+C → exit
              tui.stop();
              resolve();
              return { consume: true };
            }
            ctrlCCount = 0;
          });

          editor.onSubmit = (text: string) => {
            void (async () => {
              const trimmed = text.trim();
              if (!trimmed) return;

              if (trimmed === '/exit' || trimmed === '/quit') {
                tui.stop();
                resolve();
                return;
              }

              // Show the user message in history
              const userMsg = new TuiText(`\x1b[1mYou:\x1b[0m ${trimmed}`, 1, 0);
              history.addChild(userMsg);
              history.addChild(new Spacer(1));

              editor.disableSubmit = true;
              loader.start();
              editor.addToHistory(trimmed);
              tui.requestRender();

              try {
                await this.session.prompt(trimmed);
              } catch (err) {
                // Display error in the chat history
                loader.stop();
                editor.disableSubmit = false;
                const errorMsg = new TuiText(
                  `\x1b[31mError: ${err instanceof Error ? err.message : String(err)}\x1b[0m`,
                  1,
                  0,
                );
                history.addChild(errorMsg);
                history.addChild(new Spacer(1));
                tui.requestRender();
              }
            })();
          };
        });
      } catch (err) {
        exitError = err instanceof Error ? err : new Error(String(err));
      } finally {
        unsubscribe();

        // Always stop the TUI to restore terminal state
        tui.stop();

        // Ensure fresh line before returning to mongosh prompt
        process.stdout.write('\n[Exited agent mode]\n');

        // ------------------------------------------------------------------
        // Restore mongosh's stdin listeners
        // ------------------------------------------------------------------
        for (const listener of savedListeners) {
          process.stdin.on('data', listener);
        }
        process.stdin.resume();
      }

      // Re-throw any error that caused the exit (outside finally for eslint)
      if (exitError) {
        throw exitError;
      }
    }
  }

  const agent = await Agent.create();

  // Register "agent" as a direct shell command that launches agent mode
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
