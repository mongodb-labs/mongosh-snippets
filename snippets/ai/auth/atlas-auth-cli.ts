import { AuthService } from './auth-service';
import open from 'open';
import { AtlasAiService } from './atlas-ai-service';
import { AtlasService } from './atlas-service';

const REDIRECT_PORT = 27097;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/redirect`;

async function main() {
  const authService = new AuthService({
    wsBaseUrl: 'https://cloud.mongodb.com',
    cloudBaseUrl: 'https://cloud.mongodb.com',
    atlasApiBaseUrl: 'https://cloud.mongodb.com/api/private',
    atlasLogin: {
      clientId: '0oajzdcznmE8GEyio297',
      issuer: 'https://auth.mongodb.com/oauth2/default',
    },
    authPortalUrl: 'https://account.mongodb.com/account/login',
    openBrowser: async (url: string) => {
      console.log('\nOpening authentication page in your default browser...');
      await open(url);
    },
  });

  try {
    console.log('Starting authentication process...');

    const userInfo = await authService.signIn();
    console.log('\nAuthenticated successfully!');
    console.log('User:', userInfo);

    // Get CSRF tokens after successful authentication
    try {
      const atlasService = new AtlasService(authService, {
        wsBaseUrl: 'https://cloud.mongodb.com',
        cloudBaseUrl: 'https://cloud.mongodb.com',
        atlasApiBaseUrl: 'https://cloud.mongodb.com/api/private',
        atlasLogin: {
          clientId: '0oajzdcznmE8GEyio297',
          issuer: 'https://auth.mongodb.com/oauth2/default',
        },
        authPortalUrl: 'https://account.mongodb.com/account/login',
      });

      const ai = new AtlasAiService({
        apiURLPreset: 'admin-api',
        atlasService,
      });

      const result = await ai.getQueryFromUserInput(
        {
          userInput: 'What is the capital of the moon?',
          databaseName: 'test',
          collectionName: 'test',
          signal: AbortSignal.timeout(10000),
          requestId: 'test',
        },
        {
          connectionOptions: {
            connectionString: 'mongodb://localhost:27017',
          },
          id: '1234',
        },
      );

      console.log('AI result:', result);
    } catch (err) {
      console.error('Error getting CSRF tokens:', err);
    }

    console.log('\nPress Ctrl+C to sign out and exit.');
    // Keep the process alive until explicitly terminated
    process.stdin.resume();

    // Handle cleanup on exit
    const cleanup = async () => {
      console.log('\nSigning out...');
      await authService.signOut();
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void cleanup();
    });
  } catch (err) {
    console.error('Failed to sign in:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
