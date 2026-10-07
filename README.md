# rehype-ruby-annotator

`rehype-ruby-annotator` は、HTML AST 内のテキストに `<ruby>` 要素を追加する rehype プラグインです。
本文中の日本語に、あらかじめ定義したふりがなを自動で付与する用途を想定しています。

```html
<p>私は日本語を読む。</p>
```

```html
<p>私は<ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby>を読む。</p>
```

## 特徴

- 登録した語句に一致したテキストへ `<ruby>` / `<rt>` / `<rp>` を挿入します。
- 重複する候補がある場合は、左から最長一致で処理します。
- `code`、`pre`、見出し、既存の `ruby` など、注釈を付けたくない要素を既定でスキップします。
- ひとつの語句の一部だけにルビを付ける指定もできます。
- `Intl.Segmenter` を使い、絵文字などの grapheme cluster も壊さず扱います。

## インストール

```sh
pnpm add rehype-ruby-annotator
```

```sh
npm install rehype-ruby-annotator
```

```sh
yarn add rehype-ruby-annotator
```

## 動作環境

- Node.js 18 以降を推奨します。
- 実行環境で `Intl.Segmenter` が利用できる必要があります。
- 古い Node.js やブラウザで使う場合は、事前に `Intl.Segmenter` の対応状況を確認してください。

## 基本的な使い方

以下は Markdown を HTML に変換する unified pipeline の最小例です。

```ts
import rehypeRuby from "rehype-ruby-annotator";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const options = {
    entries: [
        {
            segments: [
                { base: "日本語", reading: "にほんご" },
            ],
        },
        {
            segments: [
                { base: "東京駅", reading: "とうきょうえき" },
            ],
        },
    ],
};

const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeRuby, options)
    .use(rehypeStringify)
    .process("私は日本語を読む。");

console.log(String(file));
```

`segments` に指定した `base` が本文に見つかると、対応する `reading` が `<rt>` として挿入されます。

## Astro で使う例

`astro.config.mjs` の Markdown 設定に追加します。

```js
import { defineConfig } from "astro/config";
import rehypeRuby from "rehype-ruby-annotator";

export default defineConfig({
    markdown: {
        rehypePlugins: [
            [
                rehypeRuby,
                {
                    entries: [
                        {
                            segments: [
                                { base: "日本語", reading: "にほんご" },
                            ],
                        },
                        {
                            segments: [
                                { base: "東京駅", reading: "とうきょうえき" },
                            ],
                        },
                    ],
                },
            ],
        ],
    },
});
```

## エントリ形式

### 語句全体にルビを付ける

```ts
{
    segments: [
        { base: "銀河鉄道", reading: "ぎんがてつどう" },
    ],
}
```

本文の `銀河鉄道` が、次のような要素に変換されます。

```html
<ruby>銀河鉄道<rp>(</rp><rt>ぎんがてつどう</rt><rp>)</rp></ruby>
```

### 語句の一部だけにルビを付ける

`segments` には文字列も混ぜられます。文字列部分は一致には含まれますが、ルビは付きません。

```ts
{
    segments: [
        "銀",
        { base: "河", reading: "が" },
        "鉄道",
    ],
}
```

この場合、本文の `銀河鉄道` に一致し、`河` の部分だけが `<ruby>` になります。

```html
銀<ruby>河<rp>(</rp><rt>が</rt><rp>)</rp></ruby>鉄道
```

### `match` で一致文字列を明示する

通常、照合に使う文字列は `segments` から自動で組み立てられます。
意図しない指定ミスを検出したい場合は `match` を書けます。

```ts
{
    match: "日本語",
    segments: [
        { base: "日本語", reading: "にほんご" },
    ],
}
```

`match` と `segments` から推測される文字列が一致しない場合はエラーになります。

## オプション

```ts
import type { RehypeRubyOptions } from "rehype-ruby-annotator";

const options: RehypeRubyOptions = {
    entries: [],
};
```

| オプション | 型 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `entries` | `RubyEntryInput[]` | なし | ルビを付ける語句の一覧です。必須です。 |
| `additionalSkipTags` | `string[]` | `[]` | 既定のスキップ対象に追加するタグ名です。 |
| `skipTags` | `string[]` | `DEFAULT_SKIP_TAGS` | スキップ対象のタグ一覧を置き換えます。指定すると既定値は使われません。 |
| `verbose` | `boolean` | `false` | `true` のとき、初期化と変換結果のログを出します。 |
| `logger` | `RubyLogger \| false` | `console` | `verbose: true` のログ出力先です。`false` なら出力しません。 |

## 既定でスキップされるタグ

次のタグの中にあるテキストには、既定ではルビを付けません。

```txt
a, h1, h2, h3, h4, h5, h6,
code, pre, kbd, samp,
script, style, textarea,
ruby, rt, rp,
math, svg
```

既定のリストに追加する場合は `additionalSkipTags` を使います。

```ts
{
    entries,
    additionalSkipTags: ["span"],
}
```

既定のリストを使わず、完全に置き換えたい場合は `skipTags` を使います。

```ts
{
    entries,
    skipTags: ["span"],
}
```

## 一致ルール

- テキストノードごとに処理します。HTML 要素をまたいだ語句には一致しません。
- 同じ位置で複数の候補が一致する場合は、より長い語句を優先します。
- 同じ `match` を持つエントリを複数登録するとエラーになります。
- 空文字列に一致するエントリは登録できません。

## 補助 API

```ts
import {
    DEFAULT_SKIP_TAGS,
    getEntryText,
    normalizeEntry,
} from "rehype-ruby-annotator";
```

| API | 説明 |
| --- | --- |
| `DEFAULT_SKIP_TAGS` | 既定のスキップ対象タグ一覧です。 |
| `getEntryText(segments)` | `segments` から照合用テキストを組み立てます。 |
| `normalizeEntry(entry)` | `RubyEntryInput` を検証し、照合用の形式に正規化します。 |

## 開発

```sh
pnpm install
pnpm run build
pnpm test
```

`pnpm test` は TypeScript のビルド後に `node --test` を実行します。

## ライセンス

MIT
