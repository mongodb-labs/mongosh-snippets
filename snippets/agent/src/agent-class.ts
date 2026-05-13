import type { Tool } from './tools';
import type { Skill } from './types';
import type { StdoutPatcher } from './stdout-patcher';
import { printBanner } from './banner';
import createConfirmationExtension from './confirmation-extension';

export type AgentServices = {
  createAgentSessionRuntime: typeof import('@earendil-works/pi-coding-agent').createAgentSessionRuntime;
  createAgentSessionServices: typeof import('@earendil-works/pi-coding-agent').createAgentSessionServices;
  createAgentSessionFromServices: typeof import('@earendil-works/pi-coding-agent').createAgentSessionFromServices;
  SessionManager: typeof import('@earendil-works/pi-coding-agent').SessionManager;
  InteractiveMode: typeof import('@earendil-works/pi-coding-agent').InteractiveMode;
  SettingsManager: typeof import('@earendil-works/pi-coding-agent').SettingsManager;
  getAgentDir: typeof import('@earendil-works/pi-coding-agent').getAgentDir;
};

export type AgentOptions = {
  services: AgentServices;
  mongoshEvalTool: Tool;
  loadedSkills: Skill[];
  skillsDir: string;
  debugLogging: boolean;
  stdoutPatcher: StdoutPatcher;
};

export class Agent {
  private sessionManager: ReturnType<typeof import('@earendil-works/pi-coding-agent').SessionManager.create>;
  private services: AgentServices;
  private mongoshEvalTool: Tool;
  private loadedSkills: Skill[];
  private skillsDir: string;
  private debugLogging: boolean;
  private stdoutPatcher: StdoutPatcher;

  constructor(options: AgentOptions) {
    this.services = options.services;
    this.mongoshEvalTool = options.mongoshEvalTool;
    this.loadedSkills = options.loadedSkills;
    this.skillsDir = options.skillsDir;
    this.debugLogging = options.debugLogging;
    this.stdoutPatcher = options.stdoutPatcher;
    this.sessionManager = this.services.SessionManager.create(process.cwd());
  }

  async run(): Promise<void> {
    const savedListeners = process.stdin.rawListeners('data') as ((...args: unknown[]) => void)[];
    process.stdin.removeAllListeners('data');
    process.stdin.pause();

    const originalExit = process.exit.bind(process);

    try {
      const createRuntime = async (options: {
        cwd: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionManager: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStartEvent?: any;
      }) => {
        const { SettingsManager, createAgentSessionServices, createAgentSessionFromServices } = this.services;

        const settingsManager = SettingsManager.inMemory({
          quietStartup: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mongoshSkills: any[] = this.loadedSkills.map(skill => ({
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
          cwd: options.cwd,
          settingsManager,
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
${this.loadedSkills.map(s => `- ${s.name}: ${s.description}`).join('\n')}

When responding:
1. For simple questions, answer directly
2. For database queries, use mongosh_eval to check and show results
3. For performance questions, use explain plans to verify
4. Always format JSON results for readability`;
              return basePrompt;
            },
          },
        });

        return {
          ...(await createAgentSessionFromServices({
            services: sessionServices,
            sessionManager: options.sessionManager,
            sessionStartEvent: options.sessionStartEvent,
            customTools: [this.mongoshEvalTool],
          })),
          services: sessionServices,
          diagnostics: sessionServices.diagnostics,
        };
      };

      const { createAgentSessionRuntime, getAgentDir, InteractiveMode } = this.services;

      const runtime = await createAgentSessionRuntime(createRuntime, {
        cwd: process.cwd(),
        agentDir: getAgentDir(),
        sessionManager: this.sessionManager,
      });

      const mode = new InteractiveMode(runtime, {
        migratedProviders: [],
        initialImages: [],
        initialMessages: [],
        verbose: this.debugLogging,
      });

      this.stdoutPatcher.enable();
      
      await printBanner();

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
      process.exit = originalExit;
      for (const listener of savedListeners) {
        process.stdin.on('data', listener);
      }
      process.stdin.resume();
      process.stdout.write('\n[Exited agent mode]\n');
    }
  }
}
