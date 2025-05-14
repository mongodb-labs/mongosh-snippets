import process from "process";


export function output(text: string) {
  process.stdout.write(`${text}`);
}

export function createLoadingAnimation({message = 'Loading'}: {message?: string}): {
  start: (signal: AbortSignal) => void;
  stop: () => void;
} {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval: NodeJS.Timeout | null = null;
  
  return {
    start(
      signal: AbortSignal,
    ) {
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

