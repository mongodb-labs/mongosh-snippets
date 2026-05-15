import * as os from 'os';
import * as path from 'path';
import type { Tool } from './tools';
import type { Skill } from './types';
import type { StdoutPatcher } from './stdout-patcher';
import type { ShellContext } from './shell-context';
import { printBanner } from './banner';
import createConfirmationExtension from './confirmation-extension';
import { MongoshInteractiveMode } from './mongosh-interactive-mode';
import chalk from 'chalk';

export type AgentServices = {
  createAgentSessionRuntime: typeof import('@earendil-works/pi-coding-agent').createAgentSessionRuntime;
  createAgentSessionServices: typeof import('@earendil-works/pi-coding-agent').createAgentSessionServices;
  createAgentSessionFromServices: typeof import('@earendil-works/pi-coding-agent').createAgentSessionFromServices;
  SessionManager: typeof import('@earendil-works/pi-coding-agent').SessionManager;
  InteractiveMode: typeof import('@earendil-works/pi-coding-agent').InteractiveMode;
  SettingsManager: typeof import('@earendil-works/pi-coding-agent').SettingsManager;
  getAgentDir: typeof import('@earendil-works/pi-coding-agent').getAgentDir;
  AuthStorage: typeof import('@earendil-works/pi-coding-agent').AuthStorage;
  ModelRegistry: typeof import('@earendil-works/pi-coding-agent').ModelRegistry;
};

export type AgentOptions = {
  services: AgentServices;
  mongoshEvalTool: Tool;
  searchDocsTool: Tool;
  loadedSkills: Skill[];
  skillsDir: string;
  debugLogging: boolean;
  stdoutPatcher: StdoutPatcher;
  shellContext: ShellContext;
};

export class Agent {
  private static isRunning = false;

  private sessionManager: ReturnType<
    typeof import('@earendil-works/pi-coding-agent').SessionManager.create
  >;
  private services: AgentServices;
  private mongoshEvalTool: Tool;
  private searchDocsTool: Tool;
  private loadedSkills: Skill[];
  private skillsDir: string;
  private debugLogging: boolean;
  private stdoutPatcher: StdoutPatcher;
  private shellContext: ShellContext;
  private sessionId: string | undefined;
  private resumeSessionId: string | undefined;

  constructor(options: AgentOptions) {
    this.services = options.services;
    this.mongoshEvalTool = options.mongoshEvalTool;
    this.searchDocsTool = options.searchDocsTool;
    this.loadedSkills = options.loadedSkills;
    this.skillsDir = options.skillsDir;
    this.debugLogging = options.debugLogging;
    this.stdoutPatcher = options.stdoutPatcher;
    this.shellContext = options.shellContext;
    this.sessionManager = this.services.SessionManager.create(process.cwd());
  }

  static getIsRunning(): boolean {
    return Agent.isRunning;
  }

  getCurrentSessionId(): string | undefined {
    return this.sessionId;
  }

  setResumeSessionId(sessionId: string): void {
    this.resumeSessionId = sessionId;
  }

  async resume(sessionId: string): Promise<void> {
    this.resumeSessionId = sessionId;
    await this.run({ resumeSessionId: sessionId });
  }

  async run(options?: { resumeSessionId?: string }): Promise<void> {
    if (Agent.isRunning) {
      return;
    }
    Agent.isRunning = true;

    const resumeSessionId = options?.resumeSessionId ?? this.resumeSessionId;

    // Save and remove mongosh's stdin listeners to prevent interference with TUI
    // Note: We intentionally do NOT pause() stdin as the TUI needs it for input handling
    const savedListeners = process.stdin.rawListeners('data') as ((
      ...args: unknown[]
    ) => void)[];
    process.stdin.removeAllListeners('data');
    // Ensure stdin is in flowing mode for the TUI
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }
    // Save and set raw mode to enable capturing special keys (Ctrl+O, etc.)
    const originalRawMode =
      process.stdin.isTTY &&
      (process.stdin as typeof process.stdin & { isRaw?: boolean }).isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    const originalExit = process.exit.bind(process);

    try {
      const createRuntime = async (runtimeOptions: {
        cwd: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionManager: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStartEvent?: any;
      }) => {
        const {
          SettingsManager,
          createAgentSessionServices,
          createAgentSessionFromServices,
          AuthStorage,
          ModelRegistry,
        } = this.services;

        const settingsManager = SettingsManager.inMemory({
          quietStartup: true,
          enableInstallTelemetry: false,
        });

        // Create auth storage and model registry with MongoDB provider pre-configured
        const authStorage = AuthStorage.create();
        const modelRegistry = ModelRegistry.create(authStorage);

        // Register the MongoDB Docs provider (same as the ai snippet's mongodb provider)
        // Note: The MongoDB Knowledge API doesn't require authentication, but Pi SDK requires apiKey field
        modelRegistry.registerProvider('mongodb', {
          name: 'MongoDB',
          baseUrl: 'https://knowledge.mongodb.com/api/v1',
          api: 'openai-responses',
          apiKey: 'mongodb', // Dummy key - the actual API doesn't require authentication
          authHeader: false, // Don't send Authorization header
          headers: {
            'X-Request-Origin': 'mongodb-mongosh',
            'user-agent': 'mongodb-mongosh',
          },
          models: [
            {
              id: 'mongodb-chat-latest',
              name: 'MongoDB Assistant',
              reasoning: false,
              input: ['text'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 4000, // MongoDB Knowledge API max allowed
            },
          ],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mongoshSkills: any[] = this.loadedSkills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          filePath: skill.source,
          baseDir: this.skillsDir,
          source: 'custom',
          sourceInfo: {
            source: 'custom',
            path: skill.source,
          },
          disableModelInvocation: false,
        }));

        const sessionServices = await createAgentSessionServices({
          cwd: runtimeOptions.cwd,
          settingsManager,
          authStorage,
          modelRegistry,
          resourceLoaderOptions: {
            extensionFactories: [createConfirmationExtension],
            skillsOverride: (base) => ({
              skills: [...base.skills, ...mongoshSkills],
              diagnostics: base.diagnostics,
            }),
            systemPromptOverride: () => {
              const basePrompt = `You are a MongoDB assistant running inside mongosh.

You are connected to a live MongoDB instance and can execute queries and commands using the mongosh_eval tool.

Guidelines:
- Always explain what you're about to do before running queries
- Use mongosh_eval for queries, inspections, and admin commands
- For destructive operations (drop, delete, update, insert), ask for confirmation first
- Suggest optimizations when you see inefficient patterns
- Use aggregation pipelines for complex data analysis
- Check indexes before suggesting queries on large collections

Available skills:
${this.loadedSkills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}

When responding:
1. For simple questions, answer directly
2. For database queries, use mongosh_eval to check and show results
3. For performance questions, use explain plans to verify
4. Always format JSON results for readability`;
              return basePrompt;
            },
          },
        });

        // Determine if MongoDB should be the default model
        // Only default to mongodb-chat-latest if it's the only available model
        // Otherwise, require manual selection by the user
        const availableModels = modelRegistry.getAvailable();
        const mongodbModel = modelRegistry.find(
          'mongodb',
          'mongodb-chat-latest',
        );

        // Check if MongoDB is the only available model (no other providers configured)
        const otherModelsExist = availableModels.some(
          (m) => m.provider !== 'mongodb',
        );
        const shouldUseMongoDbAsDefault =
          mongodbModel && !otherModelsExist && availableModels.length > 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionFromServicesOptions: {
          services: typeof sessionServices;
          sessionManager: (typeof runtimeOptions)['sessionManager'];
          sessionStartEvent?: (typeof runtimeOptions)['sessionStartEvent'];
          customTools: Tool[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model?: any;
        } = {
          services: sessionServices,
          sessionManager: runtimeOptions.sessionManager,
          sessionStartEvent: runtimeOptions.sessionStartEvent,
          customTools: [this.mongoshEvalTool, this.searchDocsTool],
        };

        // Only set the model if MongoDB should be the default
        if (shouldUseMongoDbAsDefault) {
          sessionFromServicesOptions.model = mongodbModel;
        }

        return {
          ...(await createAgentSessionFromServices(sessionFromServicesOptions)),
          services: sessionServices,
          diagnostics: sessionServices.diagnostics,
        };
      };

      const { createAgentSessionRuntime } = this.services;

      // Use custom MongoDB agent directory
      const agentDir = path.join(os.homedir(), '.mongodb', 'mongosh', 'agent');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionStartEvent: any = resumeSessionId
        ? { type: 'session-resume', sessionId: resumeSessionId }
        : undefined;

      const runtime = await createAgentSessionRuntime(createRuntime, {
        cwd: process.cwd(),
        agentDir,
        sessionManager: this.sessionManager,
        ...(sessionStartEvent && { sessionStartEvent }),
      });

      // Create mongosh eval function for the interactive mode
      const mongoshEval = async (
        expression: string,
      ): Promise<{ output: string; error?: string }> => {
        const {
          shellEvaluator,
          originalEval,
          formatResultValue,
          instanceState,
          capturedPrintOutput,
        } = this.shellContext;

        // Clear captured output before execution
        capturedPrintOutput.length = 0;

        try {
          let rawValue = await shellEvaluator.customEval(
            originalEval,
            expression,
            instanceState.context,
            'mongosh_interactive',
          );

          // Auto-call functions that take no arguments (e.g., `history` -> `history()`)
          // This provides shell-like behavior for zero-argument functions
          if (typeof rawValue === 'function') {
            try {
              rawValue = await rawValue();
            } catch {
              // If calling fails, keep the original function reference
            }
          }

          const formatted = await formatResultValue(rawValue);

          // Build output: captured print output takes priority, then add formatted result if present
          let output: string;
          if (capturedPrintOutput.length > 0) {
            // Has captured print output - use it as primary output
            output = capturedPrintOutput.join('\n');
            // Also append formatted result if it's meaningful (not empty/undefined)
            if (formatted) {
              output += '\n' + formatted;
            }
          } else if (formatted) {
            // No captured output, but has formatted result
            output = formatted;
          } else {
            // Nothing to show
            output = '(no output)';
          }

          return { output };
        } catch (err) {
          const errorMsg =
            err instanceof Error ? `${err.name}: ${err.message}` : String(err);

          return { output: '', error: errorMsg };
        }
      };

      // Create our custom interactive mode with $ mongosh support
      const mode = new MongoshInteractiveMode(runtime, {
        migratedProviders: [],
        initialImages: [],
        initialMessages: [],
        verbose: this.debugLogging,
        shellContext: this.shellContext,
        mongoshEval,
        debugLogging: this.debugLogging,
        InteractiveMode: this.services.InteractiveMode,
      });

      this.stdoutPatcher.enable();

      await printBanner();

      // Capture session ID from sessionManager
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.sessionId = (this.sessionManager as any).sessionId;

      // Initialize the mode (sets up onSubmit handler)
      await mode.init();

      await new Promise<void>((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        process.exit = (() => {
          resolve();
        }) as any;

        mode.run().catch(() => {
          resolve();
        });
      });

      this.stdoutPatcher.disable();
    } catch (err) {
      if (this.debugLogging) {
        process.stderr.write(`[agent] Error: ${String(err)}\n`);
      }
    } finally {
      Agent.isRunning = false;
      process.exit = originalExit;
      // Restore terminal state
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(originalRawMode ?? false);
      }
      for (const listener of savedListeners) {
        process.stdin.on('data', listener);
      }
      process.stdin.resume();
      const sessionId = this.sessionId || this.resumeSessionId;
      if (sessionId) {
        process.stdout.write(
          `Exited agent mode, resume your session with:\n${chalk.green(`agent.resume ${sessionId}`)}`,
        );
      } else {
        process.stdout.write('\n[Exited agent mode]');
      }
      // Force prompt redraw - emit newline then move up to trigger readline refresh
      process.stdin.emit('data', '\n');
    }
  }
}
