import { describe, it, beforeEach, vi, expect } from 'vitest';
import type { CliContext } from './helpers.js';
import type { Config } from './config.js';
import type { AiProvider } from './providers/ai-provider.js';
import {
  createMockCliContext,
  createMockReplConfig,
} from '../test/test-helpers.js';

describe('AI', () => {
  let mockCliContext: CliContext;
  let configData: Record<string, unknown>;

  beforeEach(() => {
    const mock = createMockCliContext();
    mockCliContext = mock.context;
    configData = mock.configData;
  });

  describe('commands', () => {
    let ai: any;
    let mockAiProvider: any;

    beforeEach(async () => {
      const { Config } = await import('./config.js');
      const { AiProvider } = await import('./providers/ai-provider.js');
      const { models } = await import('./providers/models.js');

      const replConfig = createMockReplConfig(configData);

      const config = await Config.create(replConfig);
      mockAiProvider = new AiProvider(
        mockCliContext,
        config,
        models[config.get('provider')](
          config.get('model') === 'default' ? undefined : config.get('model'),
        ),
      );

      // Mock methods on the provider
      mockAiProvider.shell = vi.fn(() => Promise.resolve());
      mockAiProvider.aggregate = vi.fn(() => Promise.resolve());
      mockAiProvider.processResponse = vi.fn(() => Promise.resolve());
      mockAiProvider.respond = vi.fn(() => {});
      mockAiProvider.clear = vi.fn(() => {});
      mockAiProvider.collection = vi.fn(() => {});

      class TestAI {
        public config: Config;
        private ai: AiProvider;
        public activeCollection?: string;

        constructor({ ai, config }: { ai: AiProvider; config: Config }) {
          this.ai = ai;
          this.config = config;
        }

        cmd(prompt: string) {
          return this.ai.shell(prompt);
        }

        find(prompt: string) {
          return this.ai.aggregate(prompt);
        }

        async ask(prompt: string) {
          await this.ai.processResponse(prompt, {
            systemPrompt: 'You are a MongoDB and mongosh expert.',
            expectedOutput: 'response' as const,
          });
        }

        help() {
          this.ai.respond('help message');
        }

        clear() {
          this.ai.clear();
        }

        collection(name: string) {
          this.ai.collection(name);
        }

        async provider(providerName: string) {
          await this.config.set('provider', providerName);
          this.ai.respond(`Switched to ${providerName} provider`);
        }

        async model(modelName: string) {
          await this.config.set('model', modelName);
          this.ai.respond(`Switched to ${modelName} model`);
        }

        async askOrHelp(prompt?: string) {
          if (prompt) {
            await this.ask(prompt);
          } else {
            this.help();
          }
        }
      }

      ai = new TestAI({ ai: mockAiProvider, config });
    });

    describe('cmd', () => {
      it('should call shell method with prompt', async () => {
        await ai.cmd('insert a document');

        expect(vi.mocked(mockAiProvider.shell)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(mockAiProvider.shell)).toHaveBeenCalledWith(
          'insert a document',
        );
      });
    });

    describe('find', () => {
      it('should call aggregate method with prompt', async () => {
        await ai.find('users where age > 18');

        expect(vi.mocked(mockAiProvider.aggregate)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(mockAiProvider.aggregate)).toHaveBeenCalledWith(
          'users where age > 18',
        );
      });
    });

    describe('ask', () => {
      it('should call processResponse with prompt and config', async () => {
        await ai.ask('how do I query MongoDB?');

        expect(vi.mocked(mockAiProvider.processResponse)).toHaveBeenCalledTimes(
          1,
        );
        expect(vi.mocked(mockAiProvider.processResponse).mock.calls[0][0]).toBe(
          'how do I query MongoDB?',
        );
        expect(
          vi.mocked(mockAiProvider.processResponse).mock.calls[0][1]
            .systemPrompt,
        ).toBeTruthy();
        expect(
          vi.mocked(mockAiProvider.processResponse).mock.calls[0][1]
            .expectedOutput,
        ).toBe('response');
      });
    });

    describe('help', () => {
      it('should call respond with help message', () => {
        ai.help();

        expect(vi.mocked(mockAiProvider.respond)).toHaveBeenCalledTimes(1);
      });
    });

    describe('clear', () => {
      it('should call clear on provider', () => {
        ai.clear();

        expect(vi.mocked(mockAiProvider.clear)).toHaveBeenCalledTimes(1);
      });
    });

    describe('collection', () => {
      it('should call collection on provider', () => {
        ai.collection('users');

        expect(vi.mocked(mockAiProvider.collection)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(mockAiProvider.collection)).toHaveBeenCalledWith(
          'users',
        );
      });
    });

    describe('provider', () => {
      it('should update config and show message', async () => {
        await ai.provider('openai');

        expect(ai.config.get('provider')).toBe('openai');
        expect(vi.mocked(mockAiProvider.respond)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(mockAiProvider.respond).mock.calls[0][0]).toContain(
          'openai',
        );
      });
    });

    describe('model', () => {
      it('should update config and show message', async () => {
        await ai.model('gpt-4');

        expect(ai.config.get('model')).toBe('gpt-4');
        expect(vi.mocked(mockAiProvider.respond)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(mockAiProvider.respond).mock.calls[0][0]).toContain(
          'gpt-4',
        );
      });
    });

    describe('askOrHelp', () => {
      it('should call ask when prompt provided', async () => {
        await ai.askOrHelp('test question');

        expect(vi.mocked(mockAiProvider.processResponse)).toHaveBeenCalledTimes(
          1,
        );
        expect(vi.mocked(mockAiProvider.processResponse).mock.calls[0][0]).toBe(
          'test question',
        );
      });

      it('should call help when no prompt provided', async () => {
        await ai.askOrHelp();

        expect(vi.mocked(mockAiProvider.respond)).toHaveBeenCalledTimes(1);
      });
    });
  });
});
