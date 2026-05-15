import { inspect } from 'util';
import chalk from 'chalk';
import { highlight } from 'cli-highlight';

type ConfirmationExtensionOptions = {
  skipConfirmation?: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
  skipConfirmTools?: string[];
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

function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

function formatWithBackground(content: string): string {
  // ANSI color codes - darker gray background (48;5;236) and reset
  const BG_DARK_GRAY = '\u001b[48;5;236m';
  const RESET = '\u001b[0m';
  const PADDING = '  ';

  // Always use maximum available terminal width (minus small margin)
  const terminalWidth = process.stdout.columns || 80;
  const boxWidth = Math.max(40, terminalWidth - 2);
  const contentWidth = boxWidth - 4; // minus padding on both sides

  // Split content and wrap long lines to fit the full width
  const rawLines = content.split('\n');

  const processedLines: string[] = [];
  for (const line of rawLines) {
    const visibleLen = stripAnsiCodes(line).length;
    if (visibleLen > contentWidth) {
      // Hard wrap: keep ANSI codes, split at visible character boundary
      let currentLine = line;
      let currentVisibleLen = visibleLen;

      while (currentVisibleLen > contentWidth) {
        // Map visible character position to actual string position (preserving ANSI codes)
        let visibleCount = 0;
        let actualIndex = 0;
        for (
          let i = 0;
          i < currentLine.length && visibleCount < contentWidth;
          i++
        ) {
          if (currentLine[i] === '\u001b') {
            // Skip ANSI sequence
            while (i < currentLine.length && currentLine[i] !== 'm') {
              i++;
            }
          } else {
            visibleCount++;
          }
          actualIndex = i + 1;
        }

        processedLines.push(currentLine.slice(0, actualIndex));
        currentLine = currentLine.slice(actualIndex);
        currentVisibleLen = stripAnsiCodes(currentLine).length;
      }
      if (currentLine.length > 0) {
        processedLines.push(currentLine);
      }
    } else {
      processedLines.push(line);
    }
  }

  // Build lines with dark gray background extending to full box width
  const formattedLines = processedLines.map((line) => {
    const visibleLen = stripAnsiCodes(line).length;
    const pad = ' '.repeat(Math.max(0, contentWidth - visibleLen));
    return `${BG_DARK_GRAY}${PADDING}${line}${pad}${PADDING}${RESET}`;
  });

  // Add empty padding lines with same full-width background
  const emptyLine = `${BG_DARK_GRAY}${' '.repeat(boxWidth)}${RESET}`;

  return [emptyLine, ...formattedLines, emptyLine].join('\n');
}

function formatConfirmationMessage(
  toolName: string,
  input: Record<string, unknown>,
): { title: string; message: string } {
  if (toolName === 'mongosh_eval') {
    const expression = input.expression as string | undefined;
    if (expression) {
      const highlighted = highlight(expression, {
        language: 'javascript',
        theme: {
          keyword: chalk.magenta,
          function: chalk.cyan,
          string: chalk.green,
          number: chalk.yellow,
          comment: chalk.gray,
          operator: chalk.white,
          punctuation: chalk.white,
          literal: chalk.yellow,
          params: chalk.white,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });
      return {
        title: `Run this mongosh script? ${chalk.gray('(please review the code above)')}`,
        message: '\n' + formatWithBackground(highlighted),
      };
    }
  }

  const nameLine = formatToolName(toolName);
  const paramsSection = formatToolParams(toolName, input);
  return {
    title: 'Tool Call Confirmation',
    message: nameLine + paramsSection,
  };
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
        ui: {
          confirm: (title: string, message: string) => Promise<boolean>;
          notify: (message: string, type: 'info' | 'warning' | 'error') => void;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          custom: <T>(
            factory: (
              tui: any,
              theme: any,
              keybindings: any,
              done: (result: T) => void,
            ) => {
              render: () => string[];
              invalidate: () => void;
              handleInput?: (keyData: string) => void;
            },
            options?: {
              overlay?: boolean;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              overlayOptions?: any;
            },
          ) => Promise<T>;
          setWidget: (
            key: string,
            content:
              | string[]
              | ((
                  tui: unknown,
                  theme: unknown,
                ) => {
                  render: (width: number) => string[];
                  invalidate: () => void;
                })
              | undefined,
            options?: { position?: 'above' | 'below' },
          ) => void;
        };
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

      // Skip confirmation for whitelisted tools
      if (options.skipConfirmTools?.includes(toolName)) {
        return;
      }

      const { title, message } = formatConfirmationMessage(toolName, input);

      // Show code in chat history (static, scrollable)
      ctx.ui.notify(message, 'info');

      // Custom minimal confirm dialog using Pi SDK's custom() API with done callback
      const confirmed = await ctx.ui.custom(
        (_tui, _theme, _keybindings, done) => {
          let selectedIndex = 0;
          const opts = ['Yes', 'No'];

          return {
            render: () => {
              const lines: string[] = [];
              // Title at the top of the dialog
              lines.push(chalk.white.bold(title));
              // Yes/No options
              for (let i = 0; i < opts.length; i++) {
                const isSelected = i === selectedIndex;
                const line = isSelected
                  ? `${chalk.cyan('→')} ${chalk.cyan.bold(opts[i])}`
                  : `  ${chalk.gray(opts[i])}`;
                lines.push(line);
              }
              return lines;
            },
            invalidate: () => {},
            handleInput: (keyData: string) => {
              // Up/Down to navigate
              if (keyData === '\u001b[A') {
                // Up arrow
                selectedIndex = Math.max(0, selectedIndex - 1);
              } else if (keyData === '\u001b[B') {
                // Down arrow
                selectedIndex = Math.min(opts.length - 1, selectedIndex + 1);
              } else if (keyData === '\r' || keyData === '\n') {
                // Enter to confirm
                done(selectedIndex === 0); // Yes = index 0
              } else if (keyData === '\x03' || keyData === '\u001b') {
                // Ctrl+C or Escape to cancel
                done(false);
              } else if (keyData.toLowerCase() === 'y') {
                done(true);
              } else if (keyData.toLowerCase() === 'n') {
                done(false);
              }
            },
          };
        },
        {
          overlay: true,
          overlayOptions: {
            anchor: 'bottom-center',
            offsetY: -4, // Move up above the input field
          },
        },
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
