export interface RubySegment {
    base: string;
    reading: string;
}

export type RubyEntrySegment = RubySegment | string;

export interface RubyEntryInput {
    /**
     * Optional assertion that must match the text inferred from segments.
     */
    match?: string;
    segments: RubyEntrySegment[];
}

export interface NormalizedRubyEntry {
    match: string;
    segments: RubyEntrySegment[];
}

export interface RubyLogger {
    info(message?: unknown, ...optionalParams: unknown[]): void;
    debug(message?: unknown, ...optionalParams: unknown[]): void;
}

export interface SatteriRubyOptions {
    entries: RubyEntryInput[];
    additionalSkipTags?: string[];
    skipTags?: string[];
    logger?: RubyLogger | false;
    verbose?: boolean;
}
