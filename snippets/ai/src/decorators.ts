export interface AiCommandOptions {
  requiresPrompt?: boolean;
}

export function aiCommand({
  requiresPrompt = true,
}: AiCommandOptions = {}) {
  return function decorator<T extends Function>(
    value: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ClassMethodDecoratorContext
  ): T & { isDirectShellCommand: true } {
    const wrappedFunction = function(this: any, ...args: any[]) {
      if (requiresPrompt === false && args.length > 0) {
        throw new Error('This command does not accept any arguments');
      } else if (requiresPrompt && args.length === 0) {
        throw new Error('Please specify arguments to run');
      }
      // Combine all arguments into a single string
      const combinedString = args.join(' ').trim();
      // Call the original function with the combined string
      return value.call(this, combinedString);
    } as unknown as T;  // Cast the wrapped function to match the original type
    return Object.assign(wrappedFunction, { isDirectShellCommand: true } as const);
  }
}
