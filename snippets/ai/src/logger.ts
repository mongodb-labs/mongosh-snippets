import { EventEmitter } from 'events';

const MONGOSH_AI_IS_DEBUG = process.env.DEBUG === 'true';

class Logger extends EventEmitter {
    debug(...args: unknown[]) {
      if (MONGOSH_AI_IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.debug(...args);
        this.emit('debug', ...args);
      }
    }
  
    info(...args: unknown[]) {
      if (MONGOSH_AI_IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.info(...args);
        this.emit('info', ...args);
      }
    }
  
    error(...args: unknown[]) {
      if (MONGOSH_AI_IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.error(...args);
        this.emit('error', ...args);
      }
    }
  }
  
  export const log = new Logger();