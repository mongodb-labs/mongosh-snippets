/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, beforeEach, expect } from 'vitest';
import { AiProvider } from './ai-provider.js';
import { Config } from '../config.js';
import type { CliContext } from '../helpers.js';
import type { LanguageModel } from 'ai';
import {
  createMockCliContext,
  createMockReplConfig,
} from '../../test/test-helpers.js';

describe('AiProvider', () => {
  let mockCliContext: CliContext;
  let mockConfig: Config;
  let mockModel: LanguageModel;
  let configData: Record<string, unknown>;

  beforeEach(async () => {
    const mock = createMockCliContext();
    mockCliContext = mock.context;
    configData = mock.configData;

    const mockReplConfig = createMockReplConfig(configData);
    mockConfig = await Config.create(mockReplConfig);

    mockModel = {
      modelId: 'test-model',
      provider: 'test-provider',
      specificationVersion: 'v1',
      doGenerate: () => Promise.resolve({}) as any,
      doStream: () => Promise.resolve({}) as any,
    } as unknown as LanguageModel;
  });

  describe('constructor', () => {
    it('should create AiProvider instance', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      expect(provider).toBeTruthy();
    });

    it('should set default collection from config', async () => {
      const localConfigData = { ...configData, defaultCollection: 'users' };
      const config = await Config.create(createMockReplConfig(localConfigData));

      const provider = new AiProvider(mockCliContext, config, mockModel);
      expect(provider.activeCollection).toBe('users');
    });
  });

  describe('activeProvider', () => {
    it('should return current provider', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      expect(provider.activeProvider).toBe('mongodb');
    });
  });

  describe('activeModel', () => {
    it('should return current model', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      expect(provider.activeModel).toBe('default');
    });
  });

  describe('activeCollection', () => {
    it('should return undefined when no collection set', async () => {
      // Create a fresh config without defaultCollection
      const freshConfigData = {
        provider: 'mongodb',
        model: 'default',
        includeSampleDocs: false,
        defaultCollection: undefined,
      };
      const freshConfig = await Config.create(
        createMockReplConfig(freshConfigData),
      );
      const provider = new AiProvider(mockCliContext, freshConfig, mockModel);
      expect(provider.activeCollection).toBeUndefined();
    });

    it('should return collection after setting', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      provider.respond = () => {};
      provider.collection('users');
      expect(provider.activeCollection).toBe('users');
    });
  });

  describe('getDatabaseContext', () => {
    it('should return database and collection name', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      provider.collection('users');

      const context = provider.getDatabaseContext();
      expect(context.databaseName).toBe('testdb');
      expect(context.collectionName).toBe('users');
    });

    it('should return empty string for collection when not set', async () => {
      // Create a fresh config without defaultCollection
      const freshConfigData = {
        provider: 'mongodb',
        model: 'default',
        includeSampleDocs: false,
        defaultCollection: undefined,
      };
      const freshConfig = await Config.create(
        createMockReplConfig(freshConfigData),
      );
      const provider = new AiProvider(mockCliContext, freshConfig, mockModel);

      const context = provider.getDatabaseContext();
      expect(context.databaseName).toBe('testdb');
      expect(context.collectionName).toBe('');
    });
  });

  describe('getSampleDocuments', () => {
    it('should fetch sample documents from collection', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const docs = await provider.getSampleDocuments('users');
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBe(2);
      expect(docs[0].name).toBe('Alice');
      expect(docs[1].name).toBe('Bob');
    });
  });

  describe('collection', () => {
    it('should set active collection', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      // Mock respond to capture output
      const respondCalls: string[] = [];
      provider.respond = (text: string) => {
        respondCalls.push(text);
      };

      provider.collection('posts');
      expect(provider.activeCollection).toBe('posts');
      expect(respondCalls[0]).toContain('posts');
    });

    it('should handle undefined collection', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const respondCalls: string[] = [];
      provider.respond = (text: string) => {
        respondCalls.push(text);
      };

      provider.collection(undefined);
      expect(provider.activeCollection).toBeUndefined();
      expect(respondCalls[0]).toContain('none');
    });
  });

  describe('clear', () => {
    it('should clear session and reset to default collection', async () => {
      // Create a fresh config without defaultCollection
      const freshConfigData = {
        provider: 'mongodb',
        model: 'default',
        includeSampleDocs: false,
        defaultCollection: undefined,
      };
      const freshConfig = await Config.create(
        createMockReplConfig(freshConfigData),
      );
      const provider = new AiProvider(mockCliContext, freshConfig, mockModel);

      const respondCalls: string[] = [];
      provider.respond = (text: string) => {
        respondCalls.push(text);
      };

      provider.collection('users');
      expect(provider.activeCollection).toBe('users');

      provider.clear();
      expect(provider.activeCollection).toBeUndefined();
      expect(respondCalls[1]).toContain('Session cleared');
      expect(provider.activeCollection).toBeUndefined();
    });

    it('should restore default collection after clear', async () => {
      const localConfigData = { ...configData, defaultCollection: 'posts' };
      const config = await Config.create(createMockReplConfig(localConfigData));

      const provider = new AiProvider(mockCliContext, config, mockModel);
      provider.respond = () => {};

      provider.collection('users');
      provider.clear();

      expect(provider.activeCollection).toBe('posts');
    });
  });

  describe('onConfigChange', () => {
    it('should update model when provider changes', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      const initialModel = provider.model;

      await provider.onConfigChange({
        key: 'provider',
        value: 'ollama',
      });

      // Model should have changed
      expect(provider.model).not.toBe(initialModel);
    });

    it('should update model when model changes', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      await mockConfig.set('provider', 'openai');
      await provider.onConfigChange({
        key: 'provider',
        value: 'openai',
      });

      await provider.onConfigChange({
        key: 'model',
        value: 'gpt-4',
      });

      // Should not throw
      expect(provider.model).toBeTruthy();
    });

    it('should handle non-relevant config changes', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      await provider.onConfigChange({
        key: 'includeSampleDocs',
        value: true,
      });

      // Should not throw
      expect(provider).toBeTruthy();
    });
  });

  describe('ensureCollectionName', () => {
    it('should auto-set collection when only one exists', async () => {
      const { context: mockCtx, configData: freshConfigData } =
        createMockCliContext({
          collectionNames: ['users'],
        });

      const freshConfig = await Config.create(
        createMockReplConfig(freshConfigData),
      );

      const provider = new AiProvider(mockCtx, freshConfig, mockModel);
      const respondCalls: string[] = [];
      provider.respond = (text: string) => {
        respondCalls.push(text);
      };

      await provider.ensureCollectionName('test prompt');
      expect(provider.activeCollection).toBe('users');
      expect(respondCalls[0] ?? '').toContain('users');
    });

    it('should throw error when no collection set and multiple exist', async () => {
      const { context: mockCtx, configData: freshConfigData } =
        createMockCliContext({
          collectionNames: ['users', 'posts', 'comments'],
        });

      const freshConfig = await Config.create(
        createMockReplConfig(freshConfigData),
      );

      const provider = new AiProvider(mockCtx, freshConfig, mockModel);
      provider.respond = () => {};

      // Mock getResponseFromModel to return 'none'
      provider.getResponseFromModel = () => Promise.resolve('none');

      await expect(
        provider.ensureCollectionName('test prompt'),
      ).rejects.toThrow(/No active collection set/);
    });

    it('should not change collection if already set', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);
      provider.respond = () => {};
      provider.collection('posts');

      await provider.ensureCollectionName('test prompt');
      expect(provider.activeCollection).toBe('posts');
    });
  });

  describe('respond', () => {
    it('should write to stdout', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const writeCalls: string[] = [];
      const originalWrite = process.stdout.write;
      process.stdout.write = ((text: string) => {
        writeCalls.push(text);
        return true;
      }) as any;

      provider.respond('test output');

      process.stdout.write = originalWrite;

      expect(writeCalls.length).toBe(1);
      expect(writeCalls[0]).toBe('test output');
    });
  });

  describe('setInput', () => {
    it('should handle single line input', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const unshiftCalls: unknown[][] = [];
      const originalUnshift = process.stdin.unshift;
      process.stdin.unshift = ((...args: unknown[]) => {
        unshiftCalls.push(args);
      }) as any;

      provider.setInput('test command');

      process.stdin.unshift = originalUnshift;

      expect(unshiftCalls.length).toBe(1);
      expect(unshiftCalls[0][0]).toBe('test command');
    });

    it('should handle multiline input', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const unshiftCalls: unknown[][] = [];
      const originalUnshift = process.stdin.unshift;
      process.stdin.unshift = ((...args: unknown[]) => {
        unshiftCalls.push(args);
      }) as any;

      provider.setInput('line1\nline2');

      process.stdin.unshift = originalUnshift;

      // Should enter editor mode
      expect(unshiftCalls.length).toBe(2);
      expect(unshiftCalls[0][0]).toBe('.editor\n');
    });

    it('should trim input', () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      const unshiftCalls: unknown[][] = [];
      const originalUnshift = process.stdin.unshift;
      process.stdin.unshift = ((...args: unknown[]) => {
        unshiftCalls.push(args);
      }) as any;

      provider.setInput('  test command  ');

      process.stdin.unshift = originalUnshift;

      expect(unshiftCalls[0][0]).toBe('test command');
    });
  });

  describe('request aborting', () => {
    it('should abort existing request when new request comes in with parallelRequests disabled', async () => {
      const provider = new AiProvider(mockCliContext, mockConfig, mockModel);

      // Track abort calls
      let firstRequestAborted = false;
      let secondRequestRejected = false;

      // Mock executeRequest to simulate long-running requests
      (provider as any).executeRequest = async (
        prompt: string,
        options: any,
      ) => {
        if (prompt === 'first request') {
          // Simulate a long-running request by waiting for abort
          await new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              firstRequestAborted = true;
              reject(new Error('Aborted'));
            });
            // Keep the promise pending unless aborted
            setTimeout(resolve, 10000);
          });
        }
      };

      // Start first request (don't await it, catch any errors)
      provider
        .processResponse('first request', {
          expectedOutput: 'command',
        })
        .catch(() => {
          // Expected to be aborted
        });

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to start second request - should be rejected
      try {
        await provider.processResponse('second request', {
          expectedOutput: 'command',
        });
      } catch (error: any) {
        secondRequestRejected = true;
        expect(error.message).toContain('Parallel request was stopped');
      }

      // Verify that the first request was aborted
      expect(firstRequestAborted).toBe(true);

      // Verify that the second request was rejected
      expect(secondRequestRejected).toBe(true);
    });

    it('should allow parallel requests when parallelRequests is enabled and provider is not mongodb', async () => {
      const localConfigData = { ...configData };
      const config = await Config.create(createMockReplConfig(localConfigData));
      await config.set('provider', 'openai');
      await config.set('parallelRequests', true);
      const provider = new AiProvider(mockCliContext, config, mockModel);

      let firstRequestCompleted = false;
      let secondRequestStarted = false;
      let secondRequestCompleted = false;

      // Mock executeRequest
      (provider as any).executeRequest = async (prompt: string) => {
        if (prompt === 'first request') {
          await new Promise((resolve) => setTimeout(resolve, 50));
          firstRequestCompleted = true;
        } else if (prompt === 'second request') {
          secondRequestStarted = true;
          await new Promise((resolve) => setTimeout(resolve, 10));
          secondRequestCompleted = true;
        }
      };

      // Start first request (don't await it)
      const firstRequest = provider.processResponse('first request', {
        expectedOutput: 'command',
      });

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start second request - should succeed without aborting first
      await provider.processResponse('second request', {
        expectedOutput: 'command',
      });

      // Second request should have started and completed
      expect(secondRequestStarted).toBe(true);
      expect(secondRequestCompleted).toBe(true);

      // Wait for first request to complete
      await firstRequest;

      // Both requests should complete successfully
      expect(firstRequestCompleted).toBe(true);
    });

    it('should abort requests when provider is mongodb even if parallelRequests is enabled', async () => {
      const localConfigData = {
        ...configData,
        provider: 'mongodb',
        parallelRequests: true, // This should be ignored for mongodb
      };
      const config = await Config.create(createMockReplConfig(localConfigData));
      const provider = new AiProvider(mockCliContext, config, mockModel);

      let firstRequestAborted = false;
      let secondRequestRejected = false;

      // Mock executeRequest
      (provider as any).executeRequest = async (
        prompt: string,
        options: any,
      ) => {
        if (prompt === 'first request') {
          await new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              firstRequestAborted = true;
              reject(new Error('Aborted'));
            });
            setTimeout(resolve, 10000);
          });
        }
      };

      // Start first request (don't await it, catch any errors)
      provider
        .processResponse('first request', {
          expectedOutput: 'command',
        })
        .catch(() => {
          // Expected to be aborted
        });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to start second request - should be rejected
      try {
        await provider.processResponse('second request', {
          expectedOutput: 'command',
        });
      } catch (error: any) {
        secondRequestRejected = true;
        expect(error.message).toContain('Parallel request was stopped');
      }

      // First request should have been aborted even though parallelRequests is true
      expect(firstRequestAborted).toBe(true);

      // Second request should have been rejected
      expect(secondRequestRejected).toBe(true);
    });
  });
});
