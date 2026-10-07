import type { NormalizedRubyEntry, RubyEntrySegment } from "./types.js";

function appendSegment(segments: RubyEntrySegment[], segment: RubyEntrySegment): void {
    if (typeof segment === "string") {
        const last = segments.at(-1);
        if (typeof last === "string") {
            segments[segments.length - 1] = last + segment;
            return;
        }
    }

    segments.push(segment);
}

interface TrieNode {
    data: NormalizedRubyEntry | null;
    child?: Map<string, TrieNode>;
}

export class Trie {
    root: TrieNode;
    segmenter: Intl.Segmenter;

    constructor() {
        this.root = {
            data: null,
        };
        this.segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    }

    addData(data: NormalizedRubyEntry) {
        if (data.match.length === 0) {
            throw new Error(
                "Empty match is not allowed."
            );
        }

        let current: TrieNode = this.root;
        const segments = this.segmenter.segment(data.match);
        for (const c of segments) {
            current.child ??= new Map();

            let nextNode: TrieNode | undefined = current.child.get(c.segment);

            if (nextNode === undefined) {
                nextNode = {
                    data: null,
                };
                current.child.set(c.segment, nextNode);
            }

            current = nextNode;
        }

        if (current.data !== null) {
            throw new Error(
                `${data.match} already exists.`
            );
        } else {
            current.data = data;
        }
    }

    private search(segments: Intl.SegmentData[], index: number): [NormalizedRubyEntry | null, number] {
        let current: TrieNode = this.root;
        let result: NormalizedRubyEntry | null = null;
        let matchedEnd: number = 0;
        for (let i: number = index; i < segments.length; i++) {
            if (!current.child) {
                break;
            }

            const seg: Intl.SegmentData | undefined = segments[i];
            if (!seg) break;
            const nextNode: TrieNode | undefined = current.child.get(seg.segment);

            if (nextNode === undefined) {
                break;
            }

            if (nextNode.data !== null) {
                result = nextNode.data;
                matchedEnd = i;
            }

            current = nextNode;
        }

        return result === null ? [null, 0] : [result, matchedEnd + 1 - index];
    }

    searchAll(text: string): NormalizedRubyEntry {
        const segments: Intl.SegmentData[] = [...this.segmenter.segment(text)];
        const result: NormalizedRubyEntry = {
            match: "",
            segments: [],
        };

        let i: number = 0;
        while (i < segments.length) {
            const [res, len]: [NormalizedRubyEntry | null, number] = this.search(segments, i);
            if (res === null) {
                const seg: Intl.SegmentData | undefined = segments[i];
                if (!seg) break;
                result.match += seg.segment;
                appendSegment(result.segments, seg.segment);
                i++;
            } else {
                result.match += res.match;
                for (const s of res.segments) {
                    appendSegment(result.segments, s);
                }
                i += len;
            }
        }

        return result;
    }
}
