import type { ShellContext } from './shell-context';

export type Tool = ReturnType<typeof import('@earendil-works/pi-coding-agent').defineTool>;

export async function createMongoshEvalTool(options: {
  shellContext: ShellContext;
  debugLogging: boolean;
}): Promise<Tool> {
  const { shellContext, debugLogging } = options;
  const { defineTool } = await import('@earendil-works/pi-coding-agent');
  const { Type } = await import('@sinclair/typebox');

  const { shellEvaluator, originalEval, formatResultValue, instanceState, capturedPrintOutput } = shellContext;

  return defineTool({
    name: 'mongosh_eval',
    label: 'mongosh eval',
    description: 'Execute a mongosh shell expression against the connected MongoDB instance. ' +
      'Supports the full mongosh API: queries, aggregations, admin commands, ' +
      'direct shell commands (show dbs, use <db>, it, etc.), and auto-awaiting. ' +
      'The expression runs in the same context as the interactive mongosh REPL. ' +
      'For destructive operations (drop, delete, insert, update), ask the user to confirm first.',
    parameters: Type.Object({
      expression: Type.String({
        description: 'The mongosh expression to evaluate. Examples: "db.getMongo()", "db.users.find().limit(5)", "show dbs", "use mydb", "db.serverStatus()"',
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (_toolCallId: string, params: any) => {
      const expr: string = params.expression;

      // Clear captured output before execution
      capturedPrintOutput.length = 0;

      try {
        const rawValue = await shellEvaluator.customEval(
          originalEval,
          expr,
          instanceState.context,
          'mongosh_eval',
        );

        const formatted = await formatResultValue(rawValue);
        const parts: string[] = [];

        if (capturedPrintOutput.length > 0) {
          parts.push(capturedPrintOutput.join('\n'));
        }
        if (formatted) {
          parts.push(formatted);
        }

        const output = parts.join('\n') || '(no output)';

        if (debugLogging) {
          process.stderr.write(`[mongosh_eval] Output: ${output.substring(0, 200)}\n`);
        }

        return {
          content: [{ type: 'text' as const, text: output }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: { expression: expr } as any,
        };
      } catch (err) {
        const errorMsg = err instanceof Error
          ? `${err.name}: ${err.message}`
          : String(err);

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
