import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

type CliContext = {
  db: {
    _mongo: {
      _instanceState: {
        evaluationListener: {
          setConfig: (key: string, value: unknown) => void;
          getConfig: <T>(key: string) => Promise<T>;
        };
      };
    };
  };
};

module.exports = async (globalThis: CliContext) => {
  class Agent {
    private session: Awaited<
      ReturnType<typeof createAgentSession>
    >['session'];

    constructor({
      session,
    }: {
      session: Awaited<ReturnType<typeof createAgentSession>>['session'];
    }) {
      this.session = session;
    }

    static async create(cliContext: CliContext): Promise<Agent> {
      const authStorage = AuthStorage.create();
      const modelRegistry = ModelRegistry.create(authStorage);
      const { session } = await createAgentSession({
        sessionManager: SessionManager.inMemory(),
        authStorage,
        modelRegistry,
      });

      const agent = new Agent({
        session,
      });

      return agent;
    }

    async prompt(message: string) {
      const response = await this.session.prompt(message);
      return response;
    }

    help() {
      console.log('Pi Coding Agent for Mongosh');
      console.log('');
      console.log('Commands:');
      console.log('  agent.prompt(message) - Send a message to the Pi agent');
    }

    [Symbol.for('nodejs.util.inspect.custom')]() {
      this.help();
      return '';
    }
  }

  (globalThis as unknown as { agent: Agent }).agent =
    await Agent.create(globalThis as unknown as CliContext);
};
