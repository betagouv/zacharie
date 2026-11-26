import tseslint from 'typescript-eslint';

const ALLOWED_DIRECTIVES = [
  /^\s*eslint(-disable|-enable)?(-next-line|-line)?\b/,
  /^\s*globals?\s/,
  /^\s*@ts-(expect-error|ignore|nocheck|check)\b/,
  /^\s*prettier-ignore\b/,
  /^\s*@vite-ignore\b/,
  /^\s*[#@]__PURE__\s*$/,
  /^\s*(c8|istanbul|v8)\s+ignore\b/,
  /^\s*@vitest-environment\b/,
  /^\/\s*<reference\b/,
];

const noComments = {
  meta: {
    type: 'suggestion',
    messages: {
      noComment:
        'Pas de commentaire dans le code : rendre le code explicite, ou consigner la décision dans doc/adr/.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === 'Shebang') continue;
          if (ALLOWED_DIRECTIVES.some((re) => re.test(comment.value))) continue;
          context.report({ loc: comment.loc, messageId: 'noComment' });
        }
      },
    };
  },
};

export default tseslint.config(
  { ignores: ['dist', 'build', 'public', 'prisma', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { local: { rules: { 'no-comments': noComments } }, '@typescript-eslint': tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: { 'local/no-comments': 'error' },
  }
);
