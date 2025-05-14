import type { SimplifiedSchema } from 'mongodb-schema';
import type { AtlasService } from './atlas-service';
import type { ConnectionInfo } from '@mongodb-js/connection-info';
import type { Document } from 'mongodb';
import { EJSON } from 'bson';

type GenerativeAiInput = {
  userInput: string;
  collectionName: string;
  databaseName: string;
  schema?: SimplifiedSchema;
  sampleDocuments?: Document[];
  signal: AbortSignal;
  requestId: string;
};

// The size/token validation happens on the server, however, we do
// want to ensure we're not uploading massive documents (some folks have documents > 1mb).
const AI_MAX_REQUEST_SIZE = 5120000;
const AI_MIN_SAMPLE_DOCUMENTS = 1;

type AIAggregation = {
  content: {
    aggregation?: {
      pipeline?: string;
    };
  };
};

type AIFeatureEnablement = {
  features: {
    [featureName: string]: {
      enabled: boolean;
    };
  };
};

export type AIQuery = {
  content: {
    query: Record<
      'filter' | 'project' | 'collation' | 'sort' | 'skip' | 'limit',
      string
    >;
    aggregation?: { pipeline: string };
  };
};

function buildQueryOrAggregationMessageBody(
  input: Omit<GenerativeAiInput, 'signal' | 'requestId'>,
) {
  const sampleDocuments = input.sampleDocuments
    ? EJSON.serialize(input.sampleDocuments, {
        relaxed: false,
      })
    : undefined;

  let msgBody = JSON.stringify({
    ...input,
    sampleDocuments,
  });
  if (msgBody.length > AI_MAX_REQUEST_SIZE && sampleDocuments) {
    // When the message body is over the max size, we try
    // to see if with fewer sample documents we can still perform the request.
    // If that fails we throw an error indicating this collection's
    // documents are too large to send to the ai.
    msgBody = JSON.stringify({
      ...input,
      sampleDocuments: EJSON.serialize(
        input.sampleDocuments?.slice(0, AI_MIN_SAMPLE_DOCUMENTS) || [],
        {
          relaxed: false,
        },
      ),
    });
  }

  if (msgBody.length > AI_MAX_REQUEST_SIZE) {
    throw new Error(
      'Sorry, your request is too large. Please use a smaller prompt or try using this feature on a collection with smaller documents.',
    );
  }

  return msgBody;
}

function hasExtraneousKeys(obj: any, expectedKeys: string[]) {
  return Object.keys(obj).some((key) => !expectedKeys.includes(key));
}

export function validateAIQueryResponse(
  response: any,
): asserts response is AIQuery {
  const { content } = response ?? {};

  if (typeof content !== 'object' || content === null) {
    throw new Error('Unexpected response: expected content to be an object');
  }

  if (hasExtraneousKeys(content, ['query', 'aggregation'])) {
    throw new Error(
      'Unexpected keys in response: expected query and aggregation',
    );
  }

  const { query, aggregation } = content;

  if (!query && !aggregation) {
    throw new Error(
      'Unexpected response: expected query or aggregation, got none',
    );
  }

  if (query && typeof query !== 'object') {
    throw new Error('Unexpected response: expected query to be an object');
  }

  if (
    hasExtraneousKeys(query, [
      'filter',
      'project',
      'collation',
      'sort',
      'skip',
      'limit',
    ])
  ) {
    throw new Error(
      'Unexpected keys in response: expected filter, project, collation, sort, skip, limit, aggregation',
    );
  }

  for (const field of [
    'filter',
    'project',
    'collation',
    'sort',
    'skip',
    'limit',
  ]) {
    if (query[field] && typeof query[field] !== 'string') {
      throw new Error(
        `Unexpected response: expected field ${field} to be a string, got ${JSON.stringify(
          query[field],
          null,
          2,
        )}`,
      );
    }
  }

  if (aggregation && typeof aggregation.pipeline !== 'string') {
    throw new Error(
      `Unexpected response: expected aggregation pipeline to be a string, got ${JSON.stringify(
        aggregation,
        null,
        2,
      )}`,
    );
  }
}

export function validateAIAggregationResponse(
  response: any,
): asserts response is AIAggregation {
  const { content } = response;

  if (typeof content !== 'object' || content === null) {
    throw new Error('Unexpected response: expected content to be an object');
  }

  if (hasExtraneousKeys(content, ['aggregation'])) {
    throw new Error('Unexpected keys in response: expected aggregation');
  }

  if (content.aggregation && typeof content.aggregation.pipeline !== 'string') {
    // Compared to queries where we will always get the `query` field, for
    // aggregations backend deletes the whole `aggregation` key if pipeline is
    // empty, so we only validate `pipeline` key if `aggregation` key is present
    throw new Error(
      `Unexpected response: expected aggregation to be a string, got ${String(
        content.aggregation.pipeline,
      )}`,
    );
  }
}

const aiURLConfig = {
  // There are two different sets of endpoints we use for our requests.
  // Down the line we'd like to only use the admin api, however,
  // we cannot currently call that from the Atlas UI. Pending CLOUDP-251201
  'admin-api': {
    aggregation: 'ai/api/v1/mql-aggregation',
    query: 'ai/api/v1/mql-query',
  },
  cloud: {
    aggregation: (groupId: string) => `ai/v1/groups/${groupId}/mql-aggregation`,
    query: (groupId: string) => `ai/v1/groups/${groupId}/mql-query`,
  },
} as const;
type AIEndpoint = 'query' | 'aggregation';

export class AtlasAiService {
  private initPromise: Promise<void> | null = null;

  private apiURLPreset: 'admin-api' | 'cloud';
  private atlasService: AtlasService;

  constructor({
    apiURLPreset,
    atlasService,
  }: {
    apiURLPreset: 'admin-api' | 'cloud';
    atlasService: AtlasService;
  }) {
    this.apiURLPreset = apiURLPreset;
    this.atlasService = atlasService;
  }

  private getUrlForEndpoint(
    urlId: AIEndpoint,
    connectionInfo?: ConnectionInfo,
  ) {
    if (this.apiURLPreset === 'cloud') {
      const atlasMetadata = connectionInfo?.atlasMetadata;
      if (!atlasMetadata) {
        throw new Error(
          "Can't perform generative ai request: atlasMetadata is not available",
        );
      }

      return this.atlasService.cloudEndpoint(
        aiURLConfig[this.apiURLPreset][urlId](atlasMetadata.projectId),
      );
    }
    const urlPath = aiURLConfig[this.apiURLPreset][urlId];
    return this.atlasService.adminApiEndpoint(urlPath);
  }

  private throwIfAINotEnabled() {
    if (process.env.COMPASS_E2E_SKIP_ATLAS_SIGNIN === 'true') {
      return;
    }
  }

  private getQueryOrAggregationFromUserInput = async <T>(
    {
      urlId,
      input,
      connectionInfo,
    }: {
      urlId: 'query' | 'aggregation';
      input: GenerativeAiInput;

      connectionInfo?: ConnectionInfo;
    },
    validationFn: (res: any) => asserts res is T,
  ): Promise<T> => {
    await this.initPromise;
    this.throwIfAINotEnabled();

    const { signal, requestId, ...rest } = input;
    const msgBody = buildQueryOrAggregationMessageBody(rest);

    const url = `${this.getUrlForEndpoint(
      urlId,
      connectionInfo,
    )}?request_id=${encodeURIComponent(requestId)}`;

    const res = await this.atlasService.authenticatedFetch(url, {
      signal,
      method: 'POST',
      body: msgBody,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Sometimes the server will return empty response and calling res.json directly
    // throws and user see "Unexpected end of JSON input" error, which is not helpful.
    // So we will get the text from the response first and then try to parse it.
    // If it fails, we will throw a more helpful error message.
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Internal server error');
    }
    validationFn(data);
    return data;
  };

  async getAggregationFromUserInput(
    input: GenerativeAiInput,
    connectionInfo: ConnectionInfo,
  ) {
    return this.getQueryOrAggregationFromUserInput(
      {
        connectionInfo,
        urlId: 'aggregation',
        input,
      },
      validateAIAggregationResponse,
    );
  }

  async getQueryFromUserInput(
    input: GenerativeAiInput,
    connectionInfo: ConnectionInfo,
  ) {
    return this.getQueryOrAggregationFromUserInput(
      {
        urlId: 'query',
        input,
        connectionInfo,
      },
      validateAIQueryResponse,
    );
  }

  // Performs a post request to atlas to set the user opt in preference to true.
  async optIntoGenAIFeaturesAtlas() {
    await this.atlasService.authenticatedFetch(
      this.atlasService.cloudEndpoint(
        '/settings/optInDataExplorerGenAIFeatures',
      ),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams([['value', 'true']]),
      },
    );
  }

  private validateAIFeatureEnablementResponse(
    response: any,
  ): asserts response is AIFeatureEnablement {
    const { features } = response;
    if (typeof features !== 'object') {
      throw new Error('Unexpected response: expected features to be an object');
    }
  }
}
