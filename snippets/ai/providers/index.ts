import { getAiSdkProvider } from './generic/ai-sdk-provider';
import { getDocsAiProvider } from './docs/docs-ai-provider';
import { getAtlasAiProvider } from './atlas/atlas-ai-provider';

export const provider = {
  generic: getAiSdkProvider,
  docs: getDocsAiProvider,
  atlas: getAtlasAiProvider,
};
