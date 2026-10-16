export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [
    'prettier --write',
    'eslint --fix --max-warnings=0 --no-warn-ignored',
  ],
  '*.{json,md,mdx,css,yml,yaml}': ['prettier --write'],
};
