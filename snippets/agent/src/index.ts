import * as path from 'path';
import type { CliContext } from './types';
import { loadSkillsFromDir } from './skills-loader';
import { createShellContext } from './shell-context';
import { createMongoshEvalTool } from './tools';
import { createStdoutPatcher } from './stdout-patcher';
import { Agent } from './agent-class';

function setupDebugLogging(): boolean {
  // Ensure telemetry is disabled from pi-coding-agent
  // This is a safeguard in addition to the settings manager configuration
  process.env.PI_TELEMETRY = 'false';

  const debugLogging = process.env.DEBUG_AGENT === '1';
  const logRequests = process.env.DEBUG_AGENT_REQUESTS === '1';

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
        process.stderr.write(`[agent:fetch] ${String(method)} ${String(url)}\n`);
        const start = Date.now();
        try {
          const response = await originalFetch(input, init);
          process.stderr.write(`[agent:fetch] Response: ${String(response.status)} (${String(Date.now() - start)}ms)\n`);
          return response;
        } catch (err) {
          process.stderr.write(`[agent:fetch] Error: ${String(err)}\n`);
          throw err;
        }
      };
    }
  }

  return debugLogging;
}

async function loadServices() {
  const {
    createAgentSessionRuntime,
    createAgentSessionServices,
    createAgentSessionFromServices,
    SessionManager,
    InteractiveMode,
    SettingsManager,
    getAgentDir,
    initTheme,
    AuthStorage,
    ModelRegistry,
  } = await import('@earendil-works/pi-coding-agent');

  return {
    createAgentSessionRuntime,
    createAgentSessionServices,
    createAgentSessionFromServices,
    SessionManager,
    InteractiveMode,
    SettingsManager,
    getAgentDir,
    initTheme,
    AuthStorage,
    ModelRegistry,
  };
}

export = async (mongoshContext: CliContext) => {
  const debugLogging = setupDebugLogging();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shellContext = mongoshContext as any;

  const skillsDir = path.join(__dirname, '..', 'skills');
  const loadedSkills = loadSkillsFromDir(skillsDir);

  const shellCtx = createShellContext({ shellContext });
  const mongoshEvalTool = await createMongoshEvalTool({ shellContext: shellCtx, debugLogging });
  const stdoutPatcher = createStdoutPatcher();

  const services = await loadServices();

  // Initialize theme after loading services
  services.initTheme('dark', false);

  const agent = new Agent({
    services,
    mongoshEvalTool,
    loadedSkills,
    skillsDir,
    debugLogging,
    stdoutPatcher,
    shellContext: shellCtx,
  });

  const agentFn = async () => {
    await agent.run();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (agentFn as any).isDirectShellCommand = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (agentFn as any).returnsPromise = true;

  // Add resume method - callable as agent.resume <sessionId>
  const resumeFn = async (sessionId: string) => {
    if (!sessionId) {
      process.stderr.write('Usage: agent.resume <session-id>\n');
      return;
    }
    await agent.resume(sessionId);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (resumeFn as any).isDirectShellCommand = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (resumeFn as any).returnsPromise = true;

  // Register agent and agent.resume
  shellCtx.instanceState.shellApi['agent'] = agentFn;
  shellCtx.instanceState.context['agent'] = agentFn;
  shellCtx.instanceState.shellApi['agent.resume'] = resumeFn;
  shellCtx.instanceState.context['agent.resume'] = resumeFn;
};
