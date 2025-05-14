import chalk from 'chalk';
import process from 'process';

export function output(text: string) {
  process.stdout.write(`${text}`);
}

export class LoadingAnimation {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private i = 0;
  private interval: NodeJS.Timeout | null = null;
  private abortListener: (() => void) | null = null;
  private message: string;
  private signal: AbortSignal | null = null;

  constructor({ message = 'Loading' }: { message?: string }) {
    this.message = message;
  }

  start(signal: AbortSignal): void {
    if (this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      const frame = this.frames[(this.i = ++this.i % this.frames.length)];
      process.stdout.write(chalk.blue(`\r${frame} ${this.message}`));
    }, 80);

    this.abortListener = () => {
      this.stop();
    };

    signal.addEventListener('abort', this.abortListener, { once: true });
  }

  stop(): void {
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener('abort', this.abortListener);
      this.abortListener = null;
    }

    if (this.interval) {
      clearInterval(this.interval);
      process.stdout.write('\r\x1b[K'); // Clear the line
      this.interval = null;
    }
  }
}
