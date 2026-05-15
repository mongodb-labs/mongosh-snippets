import type { ShellContext } from '../shell-context';
import type { Tool } from './types';

export type CreateMongoshEvalToolOptions = {
  shellContext: ShellContext;
  debugLogging: boolean;
};

export async function createMongoshEvalTool(
  options: CreateMongoshEvalToolOptions,
): Promise<Tool> {
  const { shellContext, debugLogging } = options;
  const { defineTool } = await import('@earendil-works/pi-coding-agent');
  const { Type } = await import('@sinclair/typebox');

  const {
    shellEvaluator,
    originalEval,
    formatResultValue,
    instanceState,
    capturedPrintOutput,
  } = shellContext;

  return defineTool({
    name: 'mongosh_eval',
    label: 'mongosh eval',
    description:
      'Execute a mongosh shell expression against the connected MongoDB instance. ' +
      'Supports the full mongosh API: queries, aggregations, admin commands ' +
      'The expression runs in the same context as the interactive mongosh REPL.' +
      'Note: make sure to double-check with the user before running destructive or risky operations.',
    parameters: Type.Object({
      expression: Type.String({
        description:
          'The mongosh expression to evaluate. Never run `use` to switch databases and instead refer to the database name explicitly. Examples: "db.getMongo()", "db.users.find().limit(5)", "db.serverStatus()", "db.getSiblingDB(\'movies\')". The last line of the output will be the result of the tool call.',
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (_toolCallId: string, params: any) => {
      const expr: string = params.expression;

      // Clear captured output before execution
      capturedPrintOutput.length = 0;

      try {
        let rawValue = await shellEvaluator.customEval(
          originalEval,
          expr,
          instanceState.context,
          'mongosh_eval',
        );

        // Auto-call functions that take no arguments (e.g., `history` -> `history()`)
        // This provides shell-like behavior for zero-argument functions
        if (typeof rawValue === 'function') {
          try {
            rawValue = await rawValue();
          } catch {
            // If calling fails, keep the original function reference
          }
        }

        const formatted = await formatResultValue(rawValue);

        // Build output: captured print output takes priority, then add formatted result if present
        let output: string;
        if (capturedPrintOutput.length > 0) {
          // Has captured print output - use it as primary output
          output = capturedPrintOutput.join('\n');
          // Also append formatted result if it's meaningful (not empty/undefined)
          if (formatted) {
            output += '\n' + formatted;
          }
        } else if (formatted) {
          // No captured output, but has formatted result
          output = formatted;
        } else {
          // Nothing to show
          output = '(no output)';
        }

        if (debugLogging) {
          process.stderr.write(
            `[mongosh_eval] Output: ${output.substring(0, 200)}\n`,
          );
        }

        return {
          content: [{ type: 'text' as const, text: output }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: { expression: expr } as any,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? `${err.name}: ${err.message}` : String(err);

        if (debugLogging) {
          process.stderr.write(`[mongosh_eval] Error: ${errorMsg}\n`);
        }

        const parts: string[] = [];
        if (capturedPrintOutput.length > 0) {
          parts.push(capturedPrintOutput.join('\n'));
        }
        parts.push(`Error: ${errorMsg}`);

        return {
          content: [{ type: 'text' as const, text: parts.join('\n') }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: { error: errorMsg, expression: expr } as any,
        };
      }
    },
  });
}
