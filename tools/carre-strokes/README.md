# carre-strokes

Generates `src/lib/carreStrokes.ts`: the pen strokes that write the name **CarreApp** on the login (see `src/components/CarreWord.tsx`).
The generated file is committed, so **you only run this to change the words or the typefaces**.

```bash
cd tools/carre-strokes
npm install
npm run fonts   # downloads, from Google Fonts, only the glyphs each spelling needs (into fonts/, not committed)
npm run build   # writes ../../src/lib/carreStrokes.ts
```

How it works (`make-strokes.mjs`):

1. `shape.mjs` shapes each word with HarfBuzz (Arabic joins, Devanagari conjuncts) and returns the glyph outlines.
2. The outline is rasterised (resvg) and thinned to the centre line of its letters (Zhang-Suen); short spurs are pruned.
3. Each connected piece of centre line is walked as one pen path, from the side the script starts on (right for Arabic), and simplified.
   The pen width is derived from the thickest part of the piece, and the script reports how much of the glyph the pen covers (99 % or more).
4. The real logotype (`public/wordmark.svg`) goes through the same steps; in the app it is the mask of the last pen drawing.

To change the spellings or typefaces edit `spec.mjs` (`text`, and the Google Fonts `css` family). All the typefaces used are under the
SIL Open Font License: Great Vibes, Noto Serif JP, Archivo, Noto Naskh Arabic, Playfair Display, Noto Sans Devanagari, Noto Sans KR and
Ma Shan Zheng. `src/components/CarreWord.tsx` plays every word in the order of `WORDS`; the timings are constants at its top.
