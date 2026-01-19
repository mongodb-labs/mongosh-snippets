import type { CliContext } from '../src/helpers.js';

export interface MockCliContextOptions {
  databaseName?: string;
  collectionNames?: string[];
  sampleDocuments?: Record<string, unknown>[];
  configData?: Record<string, unknown>;
}

export function createMockCliContext(options: MockCliContextOptions = {}): {
  context: CliContext;
  configData: Record<string, unknown>;
} {
  const {
    databaseName = 'testdb',
    collectionNames = ['users', 'posts'],
    sampleDocuments = [
      { _id: 1, name: 'Alice' },
      { _id: 2, name: 'Bob' },
    ],
    configData: initialConfigData = {
      provider: 'mongodb',
      model: 'default',
      includeSampleDocs: false,
      defaultCollection: undefined,
      parallelRequests: false,
    },
  } = options;

  const configData = { ...initialConfigData };

  const context: CliContext = {
    ai: {},
    db: {
      _name: databaseName,
      getCollectionNames: () => Promise.resolve(collectionNames),
      getCollection: () => ({
        aggregate: () =>
          Promise.resolve({
            toArray: () => Promise.resolve(sampleDocuments),
          }),
      }),
      _mongo: {
        _instanceState: {
          evaluationListener: {
            setConfig: (key: string, value: unknown) => {
              configData[key] = value;
              return Promise.resolve();
            },
            getConfig: <T>(key: string): Promise<T> => {
              return Promise.resolve(configData[key] as T);
            },
          },
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          registerPlugin: () => {},
          shellApi: {},
          context: {},
        },
      },
    },
  };

  return { context, configData };
}

export function createMockReplConfig(configData: Record<string, unknown>) {
  return {
    set: (key: string, value: unknown) => {
      configData[key] = value;
      return Promise.resolve();
    },
    get: <T>(key: string): Promise<T> => {
      return Promise.resolve(configData[key] as T);
    },
  };
}
