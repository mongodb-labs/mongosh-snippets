import chalk from 'chalk';

export interface AiCommandOptions {
  prompt?: 'required' | 'optional' | 'none';
  alias?: string;
  description: string;
  example: string;
  hidden?: boolean;
}

export type AiCommandMetadata = {
  isDirectShellCommand: boolean;
  alias?: string;
  description: string;
  example: string;
  hidden?: boolean;
};

export function aiCommand({
  prompt = 'required',
  alias,
  description,
  example,
  hidden = false,
}: AiCommandOptions) {
  return function decorator<T extends (...args: string[]) => unknown>(
    value: T,
    context: ClassMethodDecoratorContext,
  ): T & AiCommandMetadata {
    const methodName = String(context.name);
    const wrappedFunction = function (this: unknown, ...args: string[]) {
      if (prompt === 'none' && args.length > 0) {
        throw new Error('This command does not accept any arguments');
      } else if (prompt === 'required' && args.length === 0) {
        // Display help for this specific command
        const instance = this as { ai?: { respond: (msg: string) => void } };
        const commandName = `ai.${methodName}`;
        const aliasInfo = alias ? chalk.gray(` (alias: ai.${alias})`) : '';

        let helpMessage = `${chalk.cyan.bold(commandName)}${aliasInfo}`;
        helpMessage += `\n  ${chalk.white(description)}`;
        helpMessage += `\n  ${chalk.white.bold(example)}`;

        if (instance.ai?.respond) {
          instance.ai.respond(helpMessage);
          return;
        } else {
          throw new Error(helpMessage);
        }
      }
      // Combine all arguments into a single string
      const combinedString = args.join(' ').trim();
      // Call the original function with the combined string
      return value.call(this, combinedString);
    } as unknown as T; // Cast the wrapped function to match the original type
    return Object.assign(wrappedFunction, {
      isDirectShellCommand: true,
      alias,
      description,
      example,
      hidden,
    } as const);
  };
}
