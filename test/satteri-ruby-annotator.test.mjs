import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { markdownToHtml } from "satteri";

import satteriRuby, {
    getEntryText,
    normalizeEntry,
} from "../dist/index.js";

function transform(source, options, path = "test.md") {
    return markdownToHtml(source, {
        fileURL: pathToFileURL(path),
        hastPlugins: [
            satteriRuby(options),
        ],
    });
}

test("normalizes entry text from mixed plain and ruby segments", () => {
    const segments = [
        "銀",
        { base: "河", reading: "が" },
        "鉄道",
    ];

    assert.equal(getEntryText(segments), "銀河鉄道");
    assert.deepEqual(normalizeEntry({ segments }), {
        match: "銀河鉄道",
        segments,
    });
});

test("annotates matching text with ruby nodes", () => {
    const res = transform("私は日本語です", {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
    });

    assert.equal(
        res.html,
        "<p>私は<ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby>です</p>\n",
    );
});

test("uses the longest matching entry when entries overlap", () => {
    const res = transform("東京駅へ行く", {
        entries: [
            { segments: [{ base: "東京", reading: "とうきょう" }] },
            { segments: [{ base: "東京駅", reading: "とうきょうえき" }] },
        ],
    });

    assert.equal(
        res.html,
        "<p><ruby>東京駅<rp>(</rp><rt>とうきょうえき</rt><rp>)</rp></ruby>へ行く</p>\n",
    );
});

test("does not annotate text inside skipped tags", () => {
    const res = transform("日本語`日本語`[日本語](#)", {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        additionalSkipTags: ["a"],
    });

    assert.equal(
        res.html,
        "<p><ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby><code>日本語</code><a href=\"#\">日本語</a></p>\n",
    );
});

test("supports replacing the default skip tag list", () => {
    const res = transform("`日本語`[日本語](#)", {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        skipTags: ["a"],
    });

    assert.equal(
        res.html,
        "<p><code><ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby></code><a href=\"#\">日本語</a></p>\n",
    );
});

test("annotates multiple text nodes under the same parent", () => {
    const res = transform("日本語[と](#)東京駅", {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
            { segments: [{ base: "東京駅", reading: "とうきょうえき" }] },
        ],
    });

    assert.equal(
        res.html,
        "<p><ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby><a href=\"#\">と</a><ruby>東京駅<rp>(</rp><rt>とうきょうえき</rt><rp>)</rp></ruby></p>\n",
    );
});

test("uses leftmost longest matching for partially overlapping entries", () => {
    const res = transform("東京都", {
        entries: [
            { segments: [{ base: "東京", reading: "とうきょう" }] },
            { segments: [{ base: "京都", reading: "きょうと" }] },
        ],
    });

    assert.equal(
        res.html,
        "<p><ruby>東京<rp>(</rp><rt>とうきょう</rt><rp>)</rp></ruby>都</p>\n",
    );
});

test("handles grapheme clusters such as emoji as a single match unit", () => {
    const res = transform("家族👨‍👩‍👧‍👦です", {
        entries: [
            { segments: [{ base: "👨‍👩‍👧‍👦", reading: "かぞく" }] },
        ],
    });

    assert.equal(
        res.html,
        "<p>家族<ruby>👨‍👩‍👧‍👦<rp>(</rp><rt>かぞく</rt><rp>)</rp></ruby>です</p>\n",
    );
});

test("leaves empty and non-matching text unchanged", () => {
    assert.equal(
        transform("", {
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        }).html,
        "",
    );

    assert.equal(
        transform("かな", {
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        }).html,
        "<p>かな</p>\n",
    );
});

test("stays silent by default and when logger is false", () => {
    const original = {
        log: console.log,
        info: console.info,
        debug: console.debug,
    };
    const calls = [];
    console.log = (...args) => calls.push(["log", args]);
    console.info = (...args) => calls.push(["info", args]);
    console.debug = (...args) => calls.push(["debug", args]);

    try {
        transform("日本語", {
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        });
        transform("日本語", {
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
            verbose: true,
            logger: false,
        });

        assert.deepEqual(calls, []);
    } finally {
        console.log = original.log;
        console.info = original.info;
        console.debug = original.debug;
    }
});

test("routes verbose logs to the provided logger", () => {
    const logs = [];
    const logger = {
        info: (message) => logs.push(["info", message]),
        debug: (message) => logs.push(["debug", message]),
    };

    transform("日本語", {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        verbose: true,
        logger,
    }, "verbose.md");

    assert.deepEqual(logs.slice(0, 2), [
        ["info", "[satteri-ruby] Annotator initialize start."],
        ["info", "[satteri-ruby] Annotator initialized."],
    ]);
    assert.equal(logs[2][0], "debug");
    assert.match(
        logs[2][1],
        /^\[satteri-ruby\] .*verbose\.md: 1 words, \d+\.\d{3} ms\.$/,
    );
});

test("rejects invalid entries before transforming trees", () => {
    assert.throws(
        () => normalizeEntry({
            match: "日本",
            segments: [{ base: "日本語", reading: "にほんご" }],
        }),
        /Ruby entry match mismatch/,
    );

    assert.throws(
        () => satteriRuby({ entries: [{ segments: [] }] }),
        /Empty match is not allowed/,
    );

    assert.throws(
        () => satteriRuby({
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        }),
        /日本語 already exists/,
    );
});
