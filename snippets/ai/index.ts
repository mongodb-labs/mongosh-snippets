import { AuthService } from './auth/auth-service';
import { AtlasService } from './auth/atlas-service';
import { AtlasAiService } from './auth/atlas-ai-service';
import { config } from './auth/util';
import open from 'open';

const authService = new AuthService({
  ...config['atlas'],
  openBrowser: async (url: string) => {
    console.log('\nOpening authentication page in your default browser...');
    await open(url);
  },
});

const atlasService = new AtlasService(authService, {
  ...config['atlas'],
});

const aiService = new AtlasAiService({
  atlasService,
  apiURLPreset: 'admin-api',
});

module.exports = (globalThis: any) => {
  globalThis.ai = {
    login: async () => {
      await authService.signIn();
    },
    explain: async (code: string) => {
      const result = await aiService.getQueryFromUserInput(
        {
          userInput: code,
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
      return JSON.stringify(result.content.query);
    },
    ask: async (question: string) => {
      return 'test';
    },
  };
};
