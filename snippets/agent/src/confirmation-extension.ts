import { inspect } from 'util';
import chalk from 'chalk';

type ConfirmationExtensionOptions = {
  skipConfirmation?: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
};

let globalOptions: ConfirmationExtensionOptions = {};

export function setConfirmationOptions(
  options: ConfirmationExtensionOptions,
): void {
  globalOptions = options;
}

export function getConfirmationOptions(): ConfirmationExtensionOptions {
  return globalOptions;
}

function formatToolName(toolName: string): string {
  const displayName = toolName.replace(/_/g, ' ');
  return chalk.white.bold(displayName);
}

function formatToolParams(
  toolName: string,
  input: Record<string, unknown>,
): string {
  if (toolName === 'mongosh_eval') {
    const expression = input.expression as string | undefined;
    if (expression) {
      return `\n${chalk.yellow(expression)}`;
    }
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const formatted =
      typeof value === 'string'
        ? value
        : inspect(value, { depth: 3, breakLength: 80 });
    lines.push(`  ${chalk.gray(key)}: ${formatted}`);
  }

  return lines.length > 0 ? '\n\n' + lines.join('\n') : '';
}

function formatConfirmationMessage(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const nameLine = formatToolName(toolName);
  const paramsSection = formatToolParams(toolName, input);
  return nameLine + paramsSection;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function createConfirmationExtension(pi: any): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  pi.on(
    'tool_call',
    async (
      event: {
        type: 'tool_call';
        toolCallId: string;
        toolName: string;
        input: Record<string, unknown>;
      },
      ctx: {
        ui: { confirm: (title: string, message: string) => Promise<boolean> };
      },
    ) => {
      const { toolName, input } = event;
      const options = getConfirmationOptions();

      if (options.skipConfirmation) {
        return;
      }

      if (options.allowedTools && !options.allowedTools.includes(toolName)) {
        return {
          block: true,
          reason: `Tool "${toolName}" is not in the allowed tools list.`,
        };
      }

      if (options.blockedTools?.includes(toolName)) {
        return {
          block: true,
          reason: `Tool "${toolName}" is blocked by policy.`,
        };
      }

      const message = formatConfirmationMessage(toolName, input);
      const confirmed = await ctx.ui.confirm(
        chalk.cyan('Tool Call Confirmation'),
        message,
      );

      if (!confirmed) {
        return {
          block: true,
          reason: `Tool "${toolName}" was cancelled by user.`,
        };
      }
    },
  );
}
