export type StdoutPatcher = {
  enable: () => void;
  disable: () => void;
};

export function createStdoutPatcher(options: { debugLogging: boolean }): StdoutPatcher {
  const { debugLogging } = options;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  let suppressKittyQueries = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
    if (suppressKittyQueries) {
      const str = typeof chunk === 'string' ? chunk : chunk.toString();
      // Filter out Kitty protocol query and enable sequences
      if (str.includes('\x1b[?u') || str.includes('\x1b[>7u') || str.includes('\x1b[>4;2m')) {
        if (debugLogging) {
          process.stderr.write(`[agent] Suppressed Kitty sequence: ${String(str)}\n`);
        }
        if (typeof callback === 'function') {
          callback();
        }
        return true;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalStdoutWrite as any)(chunk, encoding, callback);
  };

  return {
    enable: () => {
      suppressKittyQueries = true;
    },
    disable: () => {
      suppressKittyQueries = false;
    },
  };
}
