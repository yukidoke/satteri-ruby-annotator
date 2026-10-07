import type { Text, Element, Parents, Root, ElementContent } from 'hast';
import type { NormalizedRubyEntry, SatteriRubyOptions, RubySegment } from './types.js';
import { DEFAULT_SKIP_TAGS } from './defaults.js';
import { Trie } from './trie.js';
import { normalizeEntry } from './normalize.js';
import { defineHastPlugin, type HastVisitorContext } from 'satteri';

function rubyNode(segment: RubySegment): Element {
    return {
        type: "element",
        tagName: "ruby",
        properties: {},
        children: [
            { type: "text", value: segment.base },
            {
                type: "element",
                tagName: "rp",
                properties: {},
                children: [
                    { type: "text", value: "(" }
                ]
            },
            {
                type: "element",
                tagName: "rt",
                properties: {},
                children: [
                    { type: "text", value: segment.reading }
                ]
            },
            {
                type: "element",
                tagName: "rp",
                properties: {},
                children: [
                    { type: "text", value: ")" }
                ]
            }
        ]
    };
}

function textNode(text: string): Text {
    return {
        type: "text",
        value: text,
    };
}

function hasSkipTags(node: Text, ctx: HastVisitorContext, skipTags: Set<string>): Boolean {
    let target: Readonly<Parents> | undefined = ctx.parent(node);

    while (target) {
        if (target.type === "element" && skipTags.has(target.tagName))
            return true;

        target = ctx.parent(target);
    }

    return false;
}

export default function satteriRuby(options: SatteriRubyOptions) {
    const logger = options.verbose === true && options.logger !== false
        ? options.logger ?? console
        : undefined;

    logger?.info("[satteri-ruby] Annotator initialize start.");
    const skipTags: Set<string> = new Set(
        (options.skipTags ?? DEFAULT_SKIP_TAGS).map((tag) =>
            tag.toLowerCase(),
        ),
    );

    for (const tag of options.additionalSkipTags ?? []) {
        skipTags.add(tag.toLowerCase());
    }

    const trie: Trie = new Trie();

    for (const entry of options.entries) {
        trie.addData(normalizeEntry(entry));
    }
    logger?.info("[satteri-ruby] Annotator initialized.");

    return () => {
        const startTime: number = performance.now();
        let rubyCount: number = 0;

        return defineHastPlugin({
            name: "satteri-ruby",
            text(node, ctx) {
                if (hasSkipTags(node, ctx, skipTags)) {
                    return;
                }

                const nre: NormalizedRubyEntry = trie.searchAll(node.value);
                if (!nre.segments.some((seg) => typeof seg !== "string")) {
                    return;
                }

                const newNodes: ElementContent[] = [];
                let textBuffer: string = "";

                for (const seg of nre.segments) {
                    if (typeof seg === "string") {
                        textBuffer += seg;
                    } else {
                        if (textBuffer !== "") {
                            newNodes.push(textNode(textBuffer));
                            textBuffer = "";
                        }
                        newNodes.push(rubyNode(seg));
                        rubyCount++;
                    }
                }
                if (textBuffer !== "") {
                    newNodes.push(textNode(textBuffer));
                }

                ctx.replaceNode(node, newNodes);
            },
            after(node, ctx) {
                const durationMs: number = performance.now() - startTime;
                logger?.debug(`[satteri-ruby] ${ctx.fileURL?.pathname || "(unknown)"}: ${rubyCount} words, ${durationMs.toFixed(3)} ms.`);
            },
        });
    };
}
