import { Script } from 'vm';
import type { ShellInstanceState } from './types';

export type ShellContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shellEvaluator: any;
  originalEval: (input: string, context: object, filename: string) => unknown;
  formatResultValue: (value: unknown) => Promise<string>;
  instanceState: ShellInstanceState;
  capturedPrintOutput: string[];
};

export function createShellContext(options: {
  shellContext: { db: { _mongo: { _instanceState: ShellInstanceState } } };
}): ShellContext {
  const { shellContext } = options;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ShellEvaluator } = require('@mongosh/shell-evaluator');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toShellResult } = require('@mongosh/shell-api');

  const instanceState = shellContext.db._mongo._instanceState;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shellEvaluator = new ShellEvaluator(instanceState, (value: any) => value);

  const originalEval = (input: string, context: object, filename: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    return new Script(input, { filename }).runInContext(context as any);
  };

  const capturedPrintOutput: string[] = [];

  // Patch the context's print function to capture output
  if (instanceState.context) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalPrint = instanceState.context.print as (...args: any[]) => unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instanceState.context.print = function(...args: any[]) {
      const output = args.map((arg) =>
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      capturedPrintOutput.push(output);
      // Also call original print if it exists
      if (originalPrint) {
        return originalPrint.apply(this, args);
      }
      return undefined;
    };

    // Also patch printjson
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalPrintJson = instanceState.context.printjson as (value: any) => unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instanceState.context.printjson = function(value: any) {
      const output = typeof value === 'string'
        ? value
        : JSON.stringify(value, null, 2);
      capturedPrintOutput.push(output);
      if (originalPrintJson) {
        return originalPrintJson.call(this, value);
      }
      return undefined;
    };
  }

  const formatResultValue = async (value: unknown): Promise<string> => {
    if (value === undefined) return '';

    const shellResult = await toShellResult(value);
    const printable = shellResult.printable;

    if (printable === undefined || printable === null) {
      return String(printable);
    }

    if (typeof printable === 'string') return printable;

    try {
      if (typeof printable.toJSON === 'function') {
        return JSON.stringify(printable.toJSON(), null, 2);
      }
      return JSON.stringify(printable, null, 2);
    } catch {
      return String(printable);
    }
  };

  return {
    shellEvaluator,
    originalEval,
    formatResultValue,
    instanceState,
    capturedPrintOutput,
  };
}
