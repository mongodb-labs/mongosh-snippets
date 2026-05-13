import { inspect } from 'util';

type ConfirmationExtensionOptions = {
  skipConfirmation?: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
};

let globalOptions: ConfirmationExtensionOptions = {};

export function setConfirmationOptions(options: ConfirmationExtensionOptions): void {
  globalOptions = options;
}

export function getConfirmationOptions(): ConfirmationExtensionOptions {
  return globalOptions;
}

function formatToolCall(toolName: string, params: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`Tool: ${toolName}`);

  for (const [key, value] of Object.entries(params)) {
    const formatted = typeof value === 'string'
      ? value
      : inspect(value, { depth: 3, breakLength: 80 });
    lines.push(`  ${key}: ${formatted}`);
  }

  return lines.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function createConfirmationExtension(pi: any): void {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  pi.on('tool_call', async (event: { type: 'tool_call'; toolCallId: string; toolName: string; input: Record<string, unknown> }, ctx: { block: (reason?: string) => void; ui: { confirm: (title: string, message: string) => Promise<boolean> } }) => {
    const { toolName, input } = event;
    const options = getConfirmationOptions();

    if (options.skipConfirmation) {
      return;
    }

    if (options.allowedTools && !options.allowedTools.includes(toolName)) {
      ctx.block(`Tool "${toolName}" is not in the allowed tools list.`);
      return;
    }

    if (options.blockedTools?.includes(toolName)) {
      ctx.block(`Tool "${toolName}" is blocked by policy.`);
      return;
    }

    const formatted = formatToolCall(toolName, input);
    const confirmed = await ctx.ui.confirm('Tool Call Confirmation', formatted);

    if (!confirmed) {
      ctx.block(`Tool "${toolName}" was cancelled by user.`);
    }
  });
}
