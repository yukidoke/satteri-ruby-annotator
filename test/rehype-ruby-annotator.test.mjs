import assert from "node:assert/strict";
import test from "node:test";

import rehypeRuby, {
    getEntryText,
    normalizeEntry,
} from "../dist/index.js";

function text(value) {
    return {
        type: "text",
        value,
    };
}

function element(tagName, children) {
    return {
        type: "element",
        tagName,
        properties: {},
        children,
    };
}

function root(children) {
    return {
        type: "root",
        children,
    };
}

function ruby(base, reading) {
    return element("ruby", [
        text(base),
        element("rp", [text("(")]),
        element("rt", [text(reading)]),
        element("rp", [text(")")]),
    ]);
}

function transform(tree, options, path = "test.html") {
    rehypeRuby(options)(tree, { path });
    return tree;
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
    const tree = root([
        element("p", [
            text("私は日本語です"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        text("私は"),
        ruby("日本語", "にほんご"),
        text("です"),
    ]);
});

test("uses the longest matching entry when entries overlap", () => {
    const tree = root([
        element("p", [
            text("東京駅へ行く"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "東京", reading: "とうきょう" }] },
            { segments: [{ base: "東京駅", reading: "とうきょうえき" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        ruby("東京駅", "とうきょうえき"),
        text("へ行く"),
    ]);
});

test("does not annotate text inside skipped tags", () => {
    const tree = root([
        element("p", [
            text("日本語"),
            element("code", [
                text("日本語"),
            ]),
            element("span", [
                text("日本語"),
            ]),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        additionalSkipTags: ["span"],
    });

    assert.deepEqual(tree.children[0].children, [
        ruby("日本語", "にほんご"),
        element("code", [
            text("日本語"),
        ]),
        element("span", [
            text("日本語"),
        ]),
    ]);
});

test("supports replacing the default skip tag list", () => {
    const tree = root([
        element("p", [
            element("code", [
                text("日本語"),
            ]),
            element("span", [
                text("日本語"),
            ]),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        skipTags: ["span"],
    });

    assert.deepEqual(tree.children[0].children, [
        element("code", [
            ruby("日本語", "にほんご"),
        ]),
        element("span", [
            text("日本語"),
        ]),
    ]);
});

test("annotates multiple text nodes under the same parent", () => {
    const tree = root([
        element("p", [
            text("日本語"),
            element("em", [
                text("と"),
            ]),
            text("東京駅"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
            { segments: [{ base: "東京駅", reading: "とうきょうえき" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        ruby("日本語", "にほんご"),
        element("em", [
            text("と"),
        ]),
        ruby("東京駅", "とうきょうえき"),
    ]);
});

test("uses leftmost longest matching for partially overlapping entries", () => {
    const tree = root([
        element("p", [
            text("東京都"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "東京", reading: "とうきょう" }] },
            { segments: [{ base: "京都", reading: "きょうと" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        ruby("東京", "とうきょう"),
        text("都"),
    ]);
});

test("handles grapheme clusters such as emoji as a single match unit", () => {
    const tree = root([
        element("p", [
            text("家族👨‍👩‍👧‍👦です"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "👨‍👩‍👧‍👦", reading: "かぞく" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        text("家族"),
        ruby("👨‍👩‍👧‍👦", "かぞく"),
        text("です"),
    ]);
});

test("leaves empty and non-matching text nodes unchanged", () => {
    const tree = root([
        element("p", [
            text(""),
            text("かな"),
        ]),
    ]);

    transform(tree, {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
    });

    assert.deepEqual(tree.children[0].children, [
        text(""),
        text("かな"),
    ]);
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
        transform(root([element("p", [text("日本語")])]), {
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        });
        transform(root([element("p", [text("日本語")])]), {
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

    transform(root([element("p", [text("日本語")])]), {
        entries: [
            { segments: [{ base: "日本語", reading: "にほんご" }] },
        ],
        verbose: true,
        logger,
    }, "verbose.html");

    assert.deepEqual(logs.slice(0, 2), [
        ["info", "[rehype-ruby] Annotator initialize start."],
        ["info", "[rehype-ruby] Annotator initialized."],
    ]);
    assert.equal(logs[2][0], "debug");
    assert.match(logs[2][1], /^\[rehype-ruby\] verbose\.html: 1 words, \d+\.\d{3} ms\.$/);
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
        () => rehypeRuby({ entries: [{ segments: [] }] }),
        /Empty match is not allowed/,
    );

    assert.throws(
        () => rehypeRuby({
            entries: [
                { segments: [{ base: "日本語", reading: "にほんご" }] },
                { segments: [{ base: "日本語", reading: "にほんご" }] },
            ],
        }),
        /日本語 already exists/,
    );
});
