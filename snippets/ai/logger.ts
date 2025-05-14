import EventEmitter from "events";

const IS_DEBUG = true;

class Logger extends EventEmitter {
    debug(...args: unknown[]) {
      if (IS_DEBUG) {
        console.debug(...args);
        this.emit('debug', ...args);
      }
    }
  
    info(...args: unknown[]) {
      if (IS_DEBUG) {
        console.info(...args);
        this.emit('info', ...args);
      }
    }
  
    error(...args: unknown[]) {
      if (IS_DEBUG) {
        console.error(...args);
        this.emit('error', ...args);
      }
    }
  }
  
  export const log = new Logger();