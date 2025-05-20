
module.exports = {
  root: true,
  extends: ['@mongodb-js/eslint-config-devtools'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig-lint.json'],
  },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-var-requires': 'off',
  },
};
