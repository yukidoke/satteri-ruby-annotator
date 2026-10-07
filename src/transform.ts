import type { Element, ElementContent, Root, Text } from 'hast';
import type { VFile } from 'vfile';
import type { NormalizedRubyEntry, RehypeRubyOptions, RubySegment } from "./types.js";
import { DEFAULT_SKIP_TAGS } from './defaults.js';
import { Trie } from './trie.js';
import { normalizeEntry } from './normalize.js';
import { visitParents } from 'unist-util-visit-parents';

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

export default function rehypeRuby(options: RehypeRubyOptions) {
    const logger = options.verbose === true && options.logger !== false
        ? options.logger ?? console
        : undefined;

    logger?.info("[rehype-ruby] Annotator initialize start.");
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
    logger?.info("[rehype-ruby] Annotator initialized.");

    return (tree: Root, file: VFile) => {
        const startTime: number = performance.now();
        let rubyCount: number = 0;

        visitParents(tree, "text", (node: Text, ancestors: Array<Element | Root>) => {
            if (ancestors.some((n) => {
                return n.type === "element" && skipTags.has(n.tagName);
            })) {
                return;
            }

            const nre: NormalizedRubyEntry = trie.searchAll(node.value);
            if (!nre.segments.some((seg) => typeof seg !== "string")) {
                return;
            }

            const parent: Root | Element | undefined = ancestors.at(-1);
            if (!parent) {
                return;
            }
            const index: number = parent.children.indexOf(node);
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

            parent.children.splice(index, 1, ...newNodes);
        });

        const durationMs: number = performance.now() - startTime;
        logger?.debug(`[rehype-ruby] ${file.path || "(unknown)"}: ${rubyCount} words, ${durationMs.toFixed(3)} ms.`);
    };
}
