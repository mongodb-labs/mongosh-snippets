export function aiCommand<T extends Function>(
    value: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: ClassMethodDecoratorContext
  ): T & { isDirectShellCommand: true } {
    const wrappedFunction = function(this: any, ...args: any[]) {
      // Combine all arguments into a single string
      const combinedString = args.join(' ');
      // Call the original function with the combined string
      return value.call(this, combinedString);
    } as unknown as T;  // Cast the wrapped function to match the original type
    return Object.assign(wrappedFunction, { isDirectShellCommand: true } as const);
  }
