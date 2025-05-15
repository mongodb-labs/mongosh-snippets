import { aiCommand } from '../../decorators';
import { output } from '../../helpers';
import { AiProvider, CliContext, GetResponseOptions } from '../ai-provider';
import { AtlasAiService, AIAggregation, AIQuery } from './atlas-ai-service';
import { AtlasService } from './atlas-service';
import { AuthService } from './auth-service';
import { config } from './util';
import open from 'open';

export class AtlasAiProvider extends AiProvider {
  constructor(
    private readonly aiService: AtlasAiService,
    cliContext: CliContext,
  ) {
    super(cliContext);
  }

  async getResponse(prompt: string, {
    systemPrompt,
    signal,
    expectedOutput,
  }: GetResponseOptions): Promise<string> {
    throw new Error('This is not supported by the Atlas AI provider.');
  }

  async query(prompt: string): Promise<void> {
    const query = await this.aiService.getQueryFromUserInput(
      {
        userInput: prompt,
        signal: AbortSignal.timeout(10000),
        requestId: crypto.randomUUID(),
        ...this.getDatabaseContext(),
      },
      this.getConnectionInfo(),
    );

    this.setInput(this.createMongoShellQuery(query.content));
  }

  async aggregate(prompt: string): Promise<void> {
    const aggregation = await this.aiService.getAggregationFromUserInput(
      {
        userInput: prompt,
        signal: AbortSignal.timeout(10000),
        requestId: crypto.randomUUID(),
        ...this.getDatabaseContext(),
      },
      this.getConnectionInfo(),
    );

    this.respond(this.createMongoShellAggregation(aggregation.content));
  }

  private createMongoShellQuery(params: AIQuery['content']): string {
    const { filter, project, collation, sort, skip, limit } = params.query;

    return `db.collection.find(
    ${filter},
    ${project ? `{ projection: ${project} }` : '{}'}
  )${collation ? `.collation(${collation})` : ''}${sort ? `.sort(${sort})` : ''}${skip ? `.skip(${skip})` : ''}${limit ? `.limit(${limit})` : ''}`;
  }

  private createMongoShellAggregation(
    params: AIAggregation['content'],
  ): string {
    const { aggregation } = params;
    return `db.collection.aggregate(${aggregation?.pipeline})`;
  }
}

export function getAtlasAiProvider(cliContext: CliContext): AtlasAiProvider {
  const authService = new AuthService({
    ...config['atlas'],
    openBrowser: async (url: string) => {
      output('Opening authentication page in your default browser...');
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

  return new AtlasAiProvider(aiService, cliContext);
}
