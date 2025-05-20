const _localRequire = require('module').createRequire(__filename);
const localRequire = <T>(module: string): T => _localRequire(module);
const { EventEmitter } = localRequire<typeof import('events')>('events');

const IS_DEBUG = process.env.DEBUG === 'true';

class Logger extends EventEmitter {
    debug(...args: unknown[]) {
      if (IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.debug(...args);
        this.emit('debug', ...args);
      }
    }
  
    info(...args: unknown[]) {
      if (IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.info(...args);
        this.emit('info', ...args);
      }
    }
  
    error(...args: unknown[]) {
      if (IS_DEBUG) {
        // eslint-disable-next-line no-console
        console.error(...args);
        this.emit('error', ...args);
      }
    }
  }
  
  export const log = new Logger();