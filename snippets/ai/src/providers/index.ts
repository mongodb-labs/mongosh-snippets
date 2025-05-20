const _localRequire = require('module').createRequire(__filename);
const localRequire = <T>(module: string): T => _localRequire(module);

const getAiSdkProvider = localRequire<typeof import('./generic/ai-sdk-provider.js')>('./generic/ai-sdk-provider.js');
const getDocsAiProvider = localRequire<typeof import('./docs/docs-ai-provider.js')>('./docs/docs-ai-provider.js');

export const provider = {
  generic: getAiSdkProvider,
  docs: getDocsAiProvider,
};
