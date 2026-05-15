export type Tool = ReturnType<
  typeof import('@earendil-works/pi-coding-agent').defineTool
>;

export type SearchDocsResult = {
  results: Array<{
    url: string;
    title: string;
    text: string;
    metadata: {
      tags: string[];
      [key: string]: unknown;
    };
  }>;
};
