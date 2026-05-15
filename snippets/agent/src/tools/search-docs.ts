import type { Tool, SearchDocsResult } from './types';

export async function createSearchDocsTool(): Promise<Tool> {
  const { defineTool } = await import('@earendil-works/pi-coding-agent');
  const { Type } = await import('@sinclair/typebox');

  return defineTool({
    name: 'search_docs',
    label: 'search docs',
    description:
      'Search for information in the MongoDB documentation and knowledge base. ' +
      'This includes official documentation, curated expert guidance, and other resources provided by MongoDB.',
    parameters: Type.Object({
      query: Type.String({
        description:
          'A natural language query to search for in the MongoDB knowledge base. ' +
          'This should be a single question or a topic that is relevant to the MongoDB use case.',
      }),
      limit: Type.Optional(
        Type.Number({
          description: 'The maximum number of results to return (1-100)',
          default: 5,
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),
    execute: async (_toolCallId: string, params: { query: string; limit?: number }) => {
      const { query, limit = 5 } = params;

      try {
        const response = await fetch('https://knowledge.mongodb.com/api/v1/content/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Origin': 'mongodb-mongosh',
            'User-Agent': 'mongodb-mongosh',
          },
          body: JSON.stringify({
            query,
            limit,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to search docs: ${response.status} ${response.statusText}${errorText ? `\n${errorText}` : ''}`,
              },
            ],
            isError: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: { query, limit, error: errorText } as any,
          };
        }

        const data = (await response.json()) as SearchDocsResult;

        if (!data.results || data.results.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No results found for this query.',
              },
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            details: { query, limit, resultCount: 0 } as any,
          };
        }

        const formattedResults = data.results
          .map((result, index) => {
            const lines: string[] = [];
            lines.push(`${index + 1}. ${result.title}`);
            lines.push(`   URL: ${result.url}`);
            if (result.metadata?.tags?.length) {
              lines.push(`   Tags: ${result.metadata.tags.join(', ')}`);
            }
            lines.push('');
            lines.push(result.text.split('\n').map((line) => `   ${line}`).join('\n'));
            return lines.join('\n');
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text' as const,
              text: `Found ${data.results.length} result${data.results.length === 1 ? '' : 's'} in MongoDB documentation:\n\n${formattedResults}`,
            },
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: { query, limit, resultCount: data.results.length } as any,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error searching docs: ${errorMsg}`,
            },
          ],
          isError: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: { query, limit, error: errorMsg } as any,
        };
      }
    },
  });
}
