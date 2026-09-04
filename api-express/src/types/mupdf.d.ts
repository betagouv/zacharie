// Le package mupdf n'expose ses types que par le champ `exports` de son package.json, que la
// résolution `node` du tsconfig ne lit pas. On les réexporte donc depuis le chemin réel.
declare module 'mupdf' {
  export * from 'mupdf/dist/mupdf.js';
}
