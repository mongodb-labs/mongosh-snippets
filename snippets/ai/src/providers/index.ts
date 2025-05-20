import { getAiSdkProvider } from './generic/ai-sdk-provider.js';
import { getDocsAiProvider } from './docs/docs-ai-provider.js';

export const provider = {
  generic: getAiSdkProvider,
  docs: getDocsAiProvider,
};
