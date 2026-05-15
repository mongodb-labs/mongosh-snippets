import type { ShellContext } from './shell-context';
import type { InteractiveModeOptions } from '@earendil-works/pi-coding-agent';
import type { AgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import chalk from 'chalk';
import { truncateToWidth } from '@earendil-works/pi-tui';

// Extended interface to access private/protected members
interface ExtendedInteractiveMode {
  init(): Promise<void>;
  run(): Promise<void>;
  stop(): void;
  showError(message: string): void;
  showWarning(message: string): void;
  // Editor related
  editor: {
    onSubmit?: (text: string) => Promise<void> | void;
    onChange?: (text: string) => void;
    getText(): string;
    setText(text: string): void;
    addToHistory?(text: string): void;
    borderColor?: (str: string) => string;
  };
  defaultEditor: {
    onSubmit?: (text: string) => Promise<void> | void;
    onChange?: (text: string) => void;
    getText(): string;
    setText(text: string): void;
    addToHistory?(text: string): void;
    borderColor?: (str: string) => string;
  };
  editorContainer: {
    clear(): void;
    addChild(child: unknown): void;
  };
  ui: {
    requestRender(): void;
    setFocus(target: unknown): void;
  };
  // Private methods we'll need to access
  updateEditorBorderColor(): void;
  flushPendingBashComponents(): void;
  onInputCallback?: (text: string) => void;
  chatContainer: {
    addChild(child: unknown): void;
  };
  pendingMessagesContainer: {
    addChild(child: unknown): void;
  };
  session: {
    isStreaming: boolean;
    isCompacting: boolean;
    isBashRunning: boolean;
    prompt(
      text: string,
      options?: { streamingBehavior?: string },
    ): Promise<void>;
    recordBashResult?(
      command: string,
      result: { exitCode: number; output: string; cancelled?: boolean },
      options?: { excludeFromContext?: boolean },
    ): void;
  };
  sessionManager: {
    getCwd(): string;
  };
  isExtensionCommand?(text: string): boolean;
  queueCompactionMessage?(text: string, behavior: string): void;
  updatePendingMessagesDisplay?(): void;
  // Extension UI methods
  setExtensionWidget?(
    key: string,
    content: string[] | undefined,
    options?: { position?: 'above' | 'below' },
  ): void;
  // For mongosh mode tracking
  isMongoshMode?: boolean;
}

type MongoshEvalFunction = (expression: string) => Promise<{
  output: string;
  error?: string;
}>;

type MongoshInteractiveModeOptions = InteractiveModeOptions & {
  shellContext: ShellContext;
  mongoshEval: MongoshEvalFunction;
  debugLogging?: boolean;
  // The InteractiveMode class from @earendil-works/pi-coding-agent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  InteractiveMode: any;
};

// Mongosh execution component for UI rendering
class MongoshExecutionComponent {
  private command: string;
  private ui: ExtendedInteractiveMode['ui'];
  private excludeFromContext: boolean;
  private output: string[] = [];
  private isComplete = false;
  private exitCode?: number;
  private cancelled = false;

  constructor(
    command: string,
    ui: ExtendedInteractiveMode['ui'],
    excludeFromContext: boolean,
  ) {
    this.command = command;
    this.ui = ui;
    this.excludeFromContext = excludeFromContext;
  }

  appendOutput(chunk: string): void {
    this.output.push(chunk);
    this.ui.requestRender();
  }

  setComplete(exitCode?: number, cancelled = false): void {
    this.isComplete = true;
    this.exitCode = exitCode;
    this.cancelled = cancelled;
    this.ui.requestRender();
  }

  render(width: number): string[] {
    const lines: string[] = [];
    const prefix = this.excludeFromContext ? '$$' : '$';
    // Simple syntax highlighting with chalk - just show the command
    // Full highlighting is done via the confirmation extension for tool calls
    const header = `${chalk.gray(prefix)} ${chalk.cyan(this.command)}`;
    lines.push(truncateToWidth(header, width));

    if (this.output.length > 0) {
      const outputText = this.output.join('');
      const outputLines = outputText.split('\n');
      const prefixStr = chalk.gray('│ ');
      const prefixWidth = 2; // '│ ' is 2 visible characters
      for (const line of outputLines.slice(0, 100)) {
        const availableWidth = Math.max(0, width - prefixWidth);
        lines.push(prefixStr + truncateToWidth(line, availableWidth));
      }
      if (outputLines.length > 100) {
        lines.push(
          chalk.gray(`... ${outputLines.length - 100} more lines`),
        );
      }
    }

    if (this.isComplete) {
      if (this.cancelled) {
        lines.push(chalk.yellow('◼ cancelled'));
      } else if (this.exitCode !== undefined && this.exitCode !== 0) {
        lines.push(chalk.red(`✗ exit ${this.exitCode}`));
      } else {
        lines.push(chalk.green('✓ done'));
      }
    } else {
      lines.push(chalk.cyan('◌ running...'));
    }

    return lines;
  }

  invalidate(): void {
    this.ui.requestRender();
  }
}

// Wrapper class that adds mongosh mode to InteractiveMode
export class MongoshInteractiveMode {
  private baseMode: ExtendedInteractiveMode;
  private shellContext: ShellContext;
  private mongoshEval: MongoshEvalFunction;
  private debugLogging: boolean;
  private mongoshComponent?: MongoshExecutionComponent;
  private pendingMongoshComponents: MongoshExecutionComponent[] = [];
  private originalOnSubmit?: (text: string) => Promise<void> | void;
  private originalBorderColor?: (str: string) => string;

  constructor(
    runtimeHost: AgentSessionRuntime,
    options: MongoshInteractiveModeOptions,
  ) {
    // Store our custom options
    this.shellContext = options.shellContext;
    this.mongoshEval = options.mongoshEval;
    this.debugLogging = options.debugLogging ?? false;

    // Create the base InteractiveMode using the passed class
    const baseOptions: InteractiveModeOptions = {
      migratedProviders: options.migratedProviders,
      modelFallbackMessage: options.modelFallbackMessage,
      initialMessage: options.initialMessage,
      initialImages: options.initialImages,
      initialMessages: options.initialMessages,
      verbose: options.verbose,
    };

    this.baseMode = new options.InteractiveMode(
      runtimeHost,
      baseOptions,
    ) as ExtendedInteractiveMode;
  }

  async init(): Promise<void> {
    await this.baseMode.init();

    // Now that init is done, we can override the onSubmit handler
    this.overrideOnSubmit();
  }

  private overrideOnSubmit(): void {
    // Store the original onSubmit from the default editor
    this.originalOnSubmit = this.baseMode.defaultEditor.onSubmit;

    // Store the original onChange if it exists
    const originalOnChange = this.baseMode.defaultEditor.onChange;

    if (this.debugLogging) {
      process.stderr.write('[mongosh mode] overrideOnSubmit called\n');
    }

    // Create our wrapper onChange that detects $ prefix for visual feedback
    const wrappedOnChange = (text: string): void => {
      // Check if we're in mongosh mode (starts with $)
      const wasMongoshMode = this.baseMode.isMongoshMode;
      const isMongoshMode = text.startsWith('$');

      // Update the mode flag
      this.baseMode.isMongoshMode = isMongoshMode;

      // Update indicator if mode changed
      if (wasMongoshMode !== isMongoshMode) {
        this.updateMongoshModeIndicator();
      }

      // Call original onChange if it exists
      if (originalOnChange) {
        originalOnChange(text);
      }
    };

    // Create our wrapper onSubmit that checks for $ prefix
    const wrappedOnSubmit = async (text: string): Promise<void> => {
      if (this.debugLogging) {
        process.stderr.write(
          `[mongosh mode] wrappedOnSubmit called with: "${text.substring(0, 50)}..."\n`,
        );
      }

      // Reset mongosh mode flag
      this.baseMode.isMongoshMode = false;
      this.updateMongoshModeIndicator();

      // Handle mongosh command ($ for normal, $$ for excluded from context)
      if (text.startsWith('$')) {
        if (this.debugLogging) {
          process.stderr.write('[mongosh mode] Detected $ prefix\n');
        }
        const isExcluded = text.startsWith('$$');
        const command = isExcluded
          ? text.slice(2).trim()
          : text.slice(1).trim();

        if (command) {
          // Add to history
          this.baseMode.editor.addToHistory?.(text);

          // Handle the mongosh command
          await this.handleMongoshCommand(command, isExcluded);
          return;
        }
      }

      // Not a mongosh command - call the original handler
      // We need to call the original onSubmit which handles ! for bash and normal messages
      if (this.originalOnSubmit) {
        await this.originalOnSubmit(text);
      }
    };

    // Apply the wrapped handlers to both editors
    this.baseMode.defaultEditor.onSubmit = wrappedOnSubmit;
    this.baseMode.editor.onSubmit = wrappedOnSubmit;
    this.baseMode.defaultEditor.onChange = wrappedOnChange;
    this.baseMode.editor.onChange = wrappedOnChange;

    if (this.debugLogging) {
      process.stderr.write(
        '[mongosh mode] wrappedOnSubmit assigned to editors\n',
      );
    }
  }

  private updateMongoshModeIndicator(): void {
    // Store original border color on first call
    if (!this.originalBorderColor) {
      this.originalBorderColor = this.baseMode.editor.borderColor;
    }

    // Use green border for mongosh mode (distinct from bash mode which uses yellow/orange)
    // When not in mongosh mode, restore the original color
    this.baseMode.editor.borderColor = this.baseMode.isMongoshMode
      ? chalk.green
      : (this.originalBorderColor ?? chalk.gray);

    // Show/hide the mongosh mode text widget
    if (this.baseMode.setExtensionWidget) {
      if (this.baseMode.isMongoshMode) {
        this.baseMode.setExtensionWidget(
          'mongosh-mode-indicator',
          [chalk.green('mongosh mode')],
          { position: 'above' },
        );
      } else {
        this.baseMode.setExtensionWidget('mongosh-mode-indicator', undefined);
      }
    }

    this.baseMode.ui.requestRender();
  }

  private async handleMongoshCommand(
    command: string,
    excludeFromContext = false,
  ): Promise<void> {
    // Clear the editor
    this.baseMode.editor.setText('');

    // Create UI component for display
    this.mongoshComponent = new MongoshExecutionComponent(
      command,
      this.baseMode.ui,
      excludeFromContext,
    );

    const isDeferred = this.baseMode.session.isStreaming;

    if (isDeferred) {
      // Show in pending area when agent is streaming
      this.baseMode.pendingMessagesContainer.addChild(
        this.mongoshComponent as Parameters<
          ExtendedInteractiveMode['pendingMessagesContainer']['addChild']
        >[0],
      );
      this.pendingMongoshComponents.push(this.mongoshComponent);
    } else {
      // Show in chat immediately when agent is idle
      this.baseMode.chatContainer.addChild(
        this.mongoshComponent as Parameters<
          ExtendedInteractiveMode['chatContainer']['addChild']
        >[0],
      );
    }

    this.baseMode.ui.requestRender();

    try {
      // Execute the mongosh command
      const result = await this.mongoshEval(command);

      if (this.mongoshComponent) {
        if (result.error) {
          this.mongoshComponent.appendOutput(`Error: ${result.error}`);
          this.mongoshComponent.setComplete(1, false);
        } else {
          this.mongoshComponent.appendOutput(result.output);
          this.mongoshComponent.setComplete(0, false);
        }
      }

      // Record result in session for context (unless excluded)
      if (!excludeFromContext && this.baseMode.session.recordBashResult) {
        this.baseMode.session.recordBashResult(
          command,
          {
            exitCode: result.error ? 1 : 0,
            output: result.output,
          },
          { excludeFromContext: false },
        );
      }
    } catch (error) {
      if (this.mongoshComponent) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        this.mongoshComponent.appendOutput(`Error: ${errorMsg}`);
        this.mongoshComponent.setComplete(1, false);
      }

      if (this.debugLogging) {
        process.stderr.write(
          `[mongosh mode] Error executing command: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      }
    }

    this.mongoshComponent = undefined;
    this.baseMode.ui.requestRender();
  }

  async run(): Promise<void> {
    // The base mode's run() method handles the main loop
    // Our onSubmit override will intercept $ commands
    await this.baseMode.run();
  }

  stop(): void {
    this.baseMode.stop();
  }

  // Delegate other methods to base mode
  showError(message: string): void {
    this.baseMode.showError(message);
  }

  showWarning(message: string): void {
    this.baseMode.showWarning(message);
  }
}
