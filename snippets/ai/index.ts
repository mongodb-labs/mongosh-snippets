import { aiCommand, withLoadingAnimation } from './decorators';
import { AiProvider } from './providers/ai-provider';
import { getAtlasAiProvider } from './providers/atlas/atlas-ai-provider';

class AI {
  constructor(private readonly cliContext: any, private readonly ai: AiProvider) {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), name);
        return descriptor && typeof descriptor.value === 'function' && name !== 'constructor';
      });
    
    // for all methods, wrap them with the wrapFunction method
    for (const methodName of methods) {
      const method = (this as any)[methodName];
      if (typeof method === 'function' && method.isDirectShellCommand) {
        this.wrapFunction(methodName, method.bind(this));
      }
    }
    const instanceState = this.cliContext.db._mongo._instanceState;
    instanceState.registerPlugin(this);

    this.wrapFunction(undefined, this.help.bind(this));
  }

  private wrapFunction(name: string | undefined, fn: Function) {
    const wrapperFn = (...args: string[]) => {
      return Object.assign(fn(...args), {
        [Symbol.for('@@mongosh.syntheticPromise')]: true,
      });
    };
    wrapperFn.isDirectShellCommand = true;
    wrapperFn.returnsPromise = true;

    const instanceState = this.cliContext.db._mongo._instanceState;

    instanceState.shellApi[name ? `ai.${name}` : 'ai'] = instanceState.context[name ? `ai.${name}` : 'ai'] = wrapperFn;
  }

  @aiCommand
  @withLoadingAnimation('Generating query...')
  async query(code: string) {
    return await this.ai.query(code);
  }

  @aiCommand
  @withLoadingAnimation('Thinking...')
  async ask(code: string) {
    return await this.ai.ask(code);
  }

  @aiCommand
  async help(...args: string[]) {
    this.ai.help();
  }
}

module.exports = (globalThis: any) => {
  globalThis.ai = new AI(globalThis, getAtlasAiProvider());
};


