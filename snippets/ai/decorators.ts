import { output } from "./helpers";
import { createLoadingAnimation } from "./helpers";


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

export function withLoadingAnimation(message: string = 'Loading...') {
  return function<T extends Function>(
    value: T,
    context: ClassMethodDecoratorContext
  ): T {
    const wrappedFunction = async function(this: any, ...args: any[]) {
      const signal = AbortSignal.timeout(10000);
      const loadingAnimation = createLoadingAnimation({signal, message});
      loadingAnimation.start();

      try {
        const result = await value.call(this, ...args);
        return result;
      } finally {
        loadingAnimation.stop();
      }
    } as unknown as T;
    return wrappedFunction;
  };
}