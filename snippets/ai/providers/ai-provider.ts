import process from 'process';
import { LoadingAnimation } from '../helpers';

export type CliContext = any;

export abstract class AiProvider {
  thinking: LoadingAnimation;

  constructor(private readonly cliContext: CliContext) {
    this.thinking = new LoadingAnimation({
      message: 'Thinking...',
    });
  }

  /** @internal */
  getConnectionInfo() {
    return {
      connectionOptions: {
        connectionString: 'mongodb://localhost:27017',
      },
      id: '1234',
    };
  }

  /** @internal */
  getDatabaseContext(): {
    databaseName: string;
    collectionName: string;
  } {
    return {
      databaseName: this.cliContext.db._name,
      collectionName: '',
    };
  }

  /** @internal */
  setInput(text: string) {
    process.stdin.unshift(text);
  }
  /** @internal */
  respond(text: string) {
    process.stdout.write(text);
  }

  help() {
    this.respond(`
    AI command suite

    ai.help - show this help
    ai.query - query the AI with code, e.g. ai.query find documents where name = "Ada"
    ai.ask - ask the AI a question, e.g. ai.ask how do I run queries in mongosh?
    `);
  }

  abstract aggregate(prompt: string): Promise<void>;
  abstract query(prompt: string): Promise<void>;
  abstract ask(prompt: string): Promise<void>;
}
