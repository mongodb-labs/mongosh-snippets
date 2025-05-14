import { AIQuery } from "./auth/atlas-ai-service";

export function output(text: string) {
  process.stdout.write(`${text}`);
}

export function setInput(text: string) {
  process.stdin.unshift(text);
}
export function createLoadingAnimation({signal, message = 'Loading'}: {signal: AbortSignal, message?: string}): {
  start: (message?: string) => void;
  stop: () => void;
} {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval: NodeJS.Timeout | null = null;
  
  return {
    start() {
      interval = setInterval(() => {
        const frame = frames[i = ++i % frames.length];
        process.stdout.write(`\r${frame} ${message}`);
      }, 80);

      signal.addEventListener('abort', () => {
        if (interval) {
          clearInterval(interval);
          process.stdout.write('\r\x1b[K'); // Clear the line
        }
      }, { once: true });
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        process.stdout.write('\r\x1b[K'); // Clear the line
      }
    }
  };
  }

export class MongoshCommandBuilder {
  createMongoShellQuery(params: AIQuery['content']): string {
    const {filter, project, collation, sort, skip, limit} = params.query;
    
  return `db.collection.find(
    ${filter},
    ${project ? `{ projection: ${project} }` : '{}'}
  )${collation ? `.collation(${collation})` : ''}${sort ? `.sort(${sort})` : ''}${skip ? `.skip(${skip})` : ''}${limit ? `.limit(${limit})` : ''}`
  };
}