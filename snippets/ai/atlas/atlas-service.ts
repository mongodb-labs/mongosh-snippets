import { log } from '../../logger';
import { AuthService } from './auth-service';
import type { AtlasServiceConfig } from './util';
import { throwIfAborted } from './util';
import { throwIfNotOk } from './util';
import type { AtlasClusterMetadata } from '@mongodb-js/connection-info';

export type AtlasServiceOptions = {
  defaultHeaders?: Record<string, string>;
  disableNetworkTraffic?: boolean;
};

function normalizePath(path?: string) {
  path = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return encodeURI(path);
}

function getAutomationAgentClusterId(
  atlasMetadata: Pick<
    AtlasClusterMetadata,
    'clusterUniqueId' | 'metricsId' | 'metricsType'
  >,
): { clusterId: string } | { serverlessId: string } | { flexId: string } {
  if (atlasMetadata.metricsType === 'flex') {
    return { flexId: atlasMetadata.clusterUniqueId };
  }
  if (atlasMetadata.metricsType === 'serverless') {
    return { serverlessId: atlasMetadata.clusterUniqueId };
  }
  return { clusterId: atlasMetadata.metricsId };
}

export class AtlasService {
  private config: AtlasServiceConfig;
  constructor(
    private readonly authService: AuthService,
    config: AtlasServiceConfig,
    private readonly options?: AtlasServiceOptions,
  ) {
    this.config = config;
  }
  adminApiEndpoint(path?: string): string {
    return `${this.config.atlasApiBaseUrl}${normalizePath(path)}`;
  }
  cloudEndpoint(path?: string): string {
    return `${this.config.cloudBaseUrl}${normalizePath(path)}`;
  }

  regionalizedCloudEndpoint(
    _atlasMetadata: Pick<AtlasClusterMetadata, 'regionalBaseUrl'>,
    path?: string,
  ): string {
    // TODO: eventually should apply the regional url logic
    // https://github.com/10gen/mms/blob/9f858bb987aac6aa80acfb86492dd74c89cbb862/client/packages/project/common/ajaxPrefilter.ts#L34-L49
    return this.cloudEndpoint(path);
  }
  driverProxyEndpoint(path?: string): string {
    return `${this.config.wsBaseUrl}${normalizePath(path)}`;
  }

  async fetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (this.options?.disableNetworkTraffic) {
      throw new Error('Network traffic is not allowed');
    }
    throwIfAborted(init?.signal as AbortSignal);
    const authHeaders = await this.authService.getAuthHeaders();
    const finalHeaders = {
      ...authHeaders,
      ...this.options?.defaultHeaders,
      ...init?.headers,
    };
    log.debug('AtlasService: Making a fetch', {
      url,
      headers: finalHeaders,
      method: init?.method || 'GET',
    });
    try {
      const res = await fetch(url, {
        ...init,
        headers: finalHeaders as any,
      });
      const responseHeadersObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeadersObj[key] = value;
      });
      log.debug('AtlasService: Received API response', {
        url,
        status: res.status,
        statusText: res.statusText,
        responseHeaders: responseHeadersObj,
      });
      await throwIfNotOk(res);
      return res;
    } catch (err) {
      log.error('AtlasService: Fetch errored', {
        url,
        error: err instanceof Error ? err.message : err,
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }
  async authenticatedFetch(
    url: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const authHeaders = await this.authService.getAuthHeaders();
    log.debug('AtlasService: Authenticated fetch', { url, authHeaders });
    const res = await this.fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        ...authHeaders,
      },
    });
    return res;
  }
  async automationAgentRequest(
    atlasMetadata: AtlasClusterMetadata,
    opType: string,
    opBody: Record<string, unknown>,
  ): Promise<{ _id: string; requestType: string } | undefined> {
    const opBodyClusterId = getAutomationAgentClusterId(atlasMetadata);
    const requestUrl = this.regionalizedCloudEndpoint(
      atlasMetadata,
      `/explorer/v1/groups/${atlasMetadata.projectId}/requests/${opType}`,
    );
    const json = await this.authenticatedFetch(requestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...opBodyClusterId, ...opBody }),
    }).then((res) => {
      if (
        res.headers
          .get('content-type')
          ?.toLowerCase()
          .includes('application/json')
      ) {
        return res.json();
      }
    });
    assertAutomationAgentRequestResponse(json, opType);
    return json;
  }
  async automationAgentAwait<T>(
    atlasMetadata: AtlasClusterMetadata,
    opType: string,
    requestId: string,
  ): Promise<{
    _id: string;
    requestType: string;
    response: T[];
  }> {
    const requestUrl = this.regionalizedCloudEndpoint(
      atlasMetadata,
      `/explorer/v1/groups/${atlasMetadata.projectId}/requests/${requestId}/types/${opType}/await`,
    );
    const json = await this.authenticatedFetch(requestUrl, {
      method: 'GET',
    }).then((res) => {
      return res.json();
    });
    assertAutomationAgentAwaitResponse<T>(json, opType);
    return json;
  }
}

function assertAutomationAgentRequestResponse(
  json: any,
  opType: string,
): asserts json is { _id: string; requestType: string } {
  if (
    Object.prototype.hasOwnProperty.call(json, '_id') &&
    Object.prototype.hasOwnProperty.call(json, 'requestType') &&
    json.requestType === opType
  ) {
    return;
  }
  throw new Error(
    'Got unexpected backend response for automation agent request',
  );
}

function assertAutomationAgentAwaitResponse<T>(
  json: any,
  opType: string,
): asserts json is { _id: string; requestType: string; response: T[] } {
  if (
    Object.prototype.hasOwnProperty.call(json, '_id') &&
    Object.prototype.hasOwnProperty.call(json, 'requestType') &&
    Object.prototype.hasOwnProperty.call(json, 'response') &&
    json.requestType === opType
  ) {
    return;
  }
  throw new Error(
    'Got unexpected backend response for automation agent request await',
  );
}
