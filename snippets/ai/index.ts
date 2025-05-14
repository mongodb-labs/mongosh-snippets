import { AuthService } from './auth/auth-service';
import { AtlasService } from './auth/atlas-service';
import { AtlasAiService } from './auth/atlas-ai-service';
import { config } from './auth/util';
import { createLoadingAnimation, MongoshCommandBuilder, output, setInput } from './helpers';
import open from 'open';
import { aiCommand, withLoadingAnimation } from './decorators';

const authService = new AuthService({
  ...config['atlas'],
  openBrowser: async (url: string) => {
    output('Opening authentication page in your default browser...');
    await open(url);
  },
});

const atlasService = new AtlasService(authService, {
  ...config['atlas'],
});

const aiService = new AtlasAiService({
  atlasService,
  apiURLPreset: 'admin-api',
});

const mongoshCommandBuilder = new MongoshCommandBuilder();

class AI {
  constructor(private readonly context: any, private readonly aiService: AtlasAiService) {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), name);
        return descriptor && typeof descriptor.value === 'function' && name !== 'constructor';
      });
    console.log('Class methods:', methods);
    
    // for all methods, wrap them with the wrapFunction method
    for (const methodName of methods) {
      const method = (this as any)[methodName];
      if (typeof method === 'function' && method.isDirectShellCommand) {
        this.wrapFunction(methodName, method);
      }
    }
  }

  wrapFunction(name: string, fn: Function) {
    const wrapperFn = (...args: string[]) => {
      return Object.assign(fn(...args), {
        [Symbol.for('@@mongosh.syntheticPromise')]: true,
      });
    };
    wrapperFn.isDirectShellCommand = true;
    wrapperFn.returnsPromise = true;

    const instanceState = this.context.db._mongo._instanceState;

    (instanceState as any).shellApi[`ai.${name}`] = (instanceState as any).context[`ai.${name}`] = wrapperFn;
    instanceState.registerPlugin(this);
  }

  @aiCommand
  async query(code: string) {
    const signal = AbortSignal.timeout(10000);
      const loadingAnimation = createLoadingAnimation({signal, message: 'Generating query...'});
      loadingAnimation.start();

      const result = await aiService.getQueryFromUserInput(
        {
          userInput: code,
          databaseName: 'test',
          collectionName: 'test',
          signal,
          requestId: 'test',
        },
        {
          connectionOptions: {
            connectionString: 'mongodb://localhost:27017',
          },
          id: '1234',
        },
      );
      loadingAnimation.stop();

      const query = mongoshCommandBuilder.createMongoShellQuery(result.content);
      setInput(query);
  }

  @aiCommand
  @withLoadingAnimation('Generating help...')
  async help(...args: string[]) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}


module.exports = (globalThis: any) => {
  globalThis.ai = new AI(globalThis, aiService);
};


