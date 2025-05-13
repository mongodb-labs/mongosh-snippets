import type { ArgsWithSignal } from './atlas-auth-service';
import { AtlasAuthService } from './atlas-auth-service';
import type { AtlasUserInfo, AtlasServiceConfig } from './util';
import { throwIfAborted } from './util';
import { EventEmitter } from 'events';
import { createMongoDBOIDCPlugin } from '@mongodb-js/oidc-plugin';
import { oidcServerRequestHandler } from '@mongodb-js/devtools-connect';
import { Server } from 'http';

class OIDCLogger extends EventEmitter {
  debug(...args: unknown[]) {
    console.debug(...args);
    this.emit('debug', ...args);
  }

  info(...args: unknown[]) {
    console.info(...args);
    this.emit('info', ...args);
  }

  error(...args: unknown[]) {
    console.error(...args);
    this.emit('error', ...args);
  }
}

const redirectRequestHandler = oidcServerRequestHandler.bind(null, {
  productName: 'Compass',
  productDocsLink: 'https://www.mongodb.com/docs/compass',
});

export class AuthService extends AtlasAuthService {
  private currentUser: AtlasUserInfo | null = null;
  private config: AtlasServiceConfig;
  private openBrowser: (url: string) => Promise<void>;
  private server: Server | null = null;
  private plugin: ReturnType<typeof createMongoDBOIDCPlugin>;

  constructor(config: {
    wsBaseUrl: string;
    cloudBaseUrl: string;
    atlasApiBaseUrl: string;
    atlasLogin: {
      clientId: string;
      issuer: string;
    };
    authPortalUrl: string;
    openBrowser: (url: string) => Promise<void>;
  }) {
    super();
    const { openBrowser, ...atlasConfig } = config;
    this.config = atlasConfig;
    this.openBrowser = openBrowser;
    console.log('Initializing AuthService with config:', {
      ...this.config,
    });

    this.plugin = this.plugin = createMongoDBOIDCPlugin({
      redirectServerRequestHandler: (data) => {
        if (data.result === 'redirecting') {
          const { res, status, location } = data;
          res.statusCode = status;
          const redirectUrl = new URL(this.config.authPortalUrl);
          redirectUrl.searchParams.set('fromURI', location);
          res.setHeader('Location', redirectUrl.toString());
          res.end();
          return;
        }

        redirectRequestHandler(data);
      },
      openBrowser: async ({ url }) => {
        await this.openBrowser(url);
      },
      allowedFlows: ['auth-code', 'device-auth'],
      logger: new OIDCLogger(),
    });
  }

  private async cleanupServer(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getAuthHeaders(opts: ArgsWithSignal = {}) {
    throwIfAborted(opts.signal);
    const token =
      await this.plugin.mongoClientOptions.authMechanismProperties.OIDC_HUMAN_CALLBACK(
        {
          idpInfo: {
            clientId: this.config.atlasLogin.clientId,
            issuer: this.config.atlasLogin.issuer,
          },
          version: 1,
        },
      );
    if (!token) {
      throw new Error('Not authenticated');
    }
    return {
      Authorization: `Bearer ${token.accessToken}`,
    };
  }

  async isAuthenticated(opts?: ArgsWithSignal): Promise<boolean> {
    throwIfAborted(opts?.signal);
    try {
      const token =
        await this.plugin.mongoClientOptions.authMechanismProperties.OIDC_HUMAN_CALLBACK(
          {
            idpInfo: {
              clientId: this.config.atlasLogin.clientId,
              issuer: this.config.atlasLogin.issuer,
            },
            version: 1,
          },
        );
      return !!token;
    } catch {
      return false;
    }
  }

  private token: string | null = null;

  async signIn(
    opts: ArgsWithSignal<{ mainProcessSignIn?: boolean }> = {},
  ): Promise<AtlasUserInfo> {
    throwIfAborted(opts.signal);

    try {
      this.token = (
        await this.plugin.mongoClientOptions.authMechanismProperties.OIDC_HUMAN_CALLBACK(
          {
            version: 1,
            idpInfo: {
              clientId: this.config.atlasLogin.clientId,
              issuer: this.config.atlasLogin.issuer,
            },
          },
        )
      ).accessToken;

      console.log('token', this.token);
      return {
        primaryEmail: 'test@example.com',
        sub: 'test',
        firstName: 'test',
        lastName: 'test',
        login: 'test',
      };
      // const userInfo = await this.getUserInfo(opts);
      // this.currentUser = userInfo;
      // this.emit('signed-in');
      // return userInfo;
    } catch (err) {
      this.currentUser = null;
      console.error('Sign-in error:', err);
      throw err;
    }
  }

  async getUserInfo(opts?: ArgsWithSignal): Promise<AtlasUserInfo> {
    throwIfAborted(opts?.signal);
    const token = this.token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    if (this.currentUser) {
      return this.currentUser;
    }

    const userInfoUrl = new URL('./v1/userinfo', this.config.atlasLogin.issuer);
    const response = await fetch(userInfoUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: opts?.signal,
    });

    throwIfAborted(opts?.signal);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('User info request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Failed to get user info: ${response.status} ${response.statusText}`,
      );
    }

    const userInfo = await response.json();
    this.currentUser = userInfo;
    return userInfo;
  }

  async signOut(): Promise<void> {
    try {
      await this.plugin.destroy();
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      this.currentUser = null;
      await this.cleanupServer();
      this.emit('signed-out');
    }
  }
}
