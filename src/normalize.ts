import type { NormalizedRubyEntry, RubyEntryInput, RubyEntrySegment } from "./types.js";

export function getEntryText(segments: RubyEntrySegment[]): string {
    return segments
        .map((segment) =>
            typeof segment === "string" ? segment : segment.base,
        )
        .join("");
}

export function normalizeEntry(entry: RubyEntryInput): NormalizedRubyEntry {
    const inferredMatch = getEntryText(entry.segments);

    if (entry.match !== undefined && entry.match !== inferredMatch) {
        throw new Error(
            `Ruby entry match mismatch: match="${entry.match}", segments="${inferredMatch}"`,
        );
    }

    return {
        match: inferredMatch,
        segments: entry.segments,
    }
}