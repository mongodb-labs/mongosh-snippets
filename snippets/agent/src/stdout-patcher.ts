export type StdoutPatcher = {
  enable: () => void;
  disable: () => void;
};

// Specific problematic Kitty protocol sequences to suppress
const KITTY_QUERY = '\x1b[?u';
const KITTY_ENABLE_7U = '\x1b[>7u';
const KITTY_ENABLE_4_2M = '\x1b[>4;2m';

export function createStdoutPatcher(): StdoutPatcher {
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  let suppressKittyQueries = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterWrite = (original: any) =>
    function (chunk: any, encoding?: any, callback?: any) {
      if (suppressKittyQueries) {
        const str = typeof chunk === 'string' ? chunk : chunk.toString();
        // Only suppress specific Kitty protocol sequences (not general color codes)
        const isKittySeq =
          str === KITTY_QUERY ||
          str === KITTY_ENABLE_7U ||
          str === KITTY_ENABLE_4_2M ||
          str.endsWith(KITTY_QUERY) ||
          str.endsWith(KITTY_ENABLE_7U) ||
          str.endsWith(KITTY_ENABLE_4_2M);
        if (isKittySeq) {
          if (typeof callback === 'function') callback();
          return true;
        }
      }
      return original(chunk, encoding, callback);
    };

  process.stdout.write = filterWrite(originalStdoutWrite);
  process.stderr.write = filterWrite(originalStderrWrite);

  return {
    enable: () => {
      suppressKittyQueries = true;
    },
    disable: () => {
      suppressKittyQueries = false;
    },
  };
}
