import { FileReviewBlock, FileReviewStatus } from "@/types";
import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

type PatchDiff = [number, string];

function stableHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function hashReviewContent(input: string): string {
  return stableHash(input);
}

function getChangedPatchRange(patch: any): {
  baselineStart: number;
  baselineEnd: number;
  headStart: number;
  headEnd: number;
  oldText: string;
  newText: string;
} {
  const diffs = (patch.diffs ?? []) as PatchDiff[];
  const hasLeadingContext = diffs[0]?.[0] === 0;
  const hasTrailingContext = diffs[diffs.length - 1]?.[0] === 0;
  const leadingContextLength = hasLeadingContext ? diffs[0][1].length : 0;
  const trailingContextLength = hasTrailingContext ? diffs[diffs.length - 1][1].length : 0;
  const changedDiffs = diffs.slice(
    hasLeadingContext ? 1 : 0,
    hasTrailingContext ? -1 : diffs.length
  );
  const baselineStart = (patch.start1 ?? 0) + leadingContextLength;
  const baselineEnd = (patch.start1 ?? 0) + (patch.length1 ?? 0) - trailingContextLength;
  const headStart = (patch.start2 ?? 0) + leadingContextLength;
  const headEnd = (patch.start2 ?? 0) + (patch.length2 ?? 0) - trailingContextLength;

  return {
    baselineStart,
    baselineEnd,
    headStart,
    headEnd,
    oldText: changedDiffs.filter(([operation]) => operation !== 1).map(([, text]) => text).join(""),
    newText: changedDiffs.filter(([operation]) => operation !== -1).map(([, text]) => text).join(""),
  };
}

export function buildFileReviewBlocks(
  baselineContent: string,
  headContent: string,
  previousBlocks: FileReviewBlock[] = []
): FileReviewBlock[] {
  const patches = dmp.patch_make(baselineContent, headContent) as any[];
  const previousBySignature = new Map(previousBlocks.map((block) => [block.signature, block]));

  return patches.map((patch: any, index) => {
    const patchText = dmp.patch_toText([patch]);
    const {
      oldText,
      newText,
      baselineStart,
      baselineEnd,
      headStart,
      headEnd,
    } = getChangedPatchRange(patch);
    const signature = stableHash([
      baselineStart,
      baselineEnd,
      oldText,
      newText,
    ].join("::"));
    const previous = previousBySignature.get(signature);

    return {
      id: previous?.id ?? `review-block-${signature}-${index}`,
      signature,
      status: previous && previous.status !== "rejected" ? previous.status : "reviewing",
      baselineStart,
      baselineEnd,
      headStart,
      headEnd,
      oldText,
      newText,
      patchText,
    };
  });
}

export function deriveFileReviewStatus(blocks: FileReviewBlock[]): FileReviewStatus {
  if (blocks.some((block) => block.status === "reviewing")) {
    return "reviewing";
  }

  return "reviewed";
}

export function rebuildContentFromReviewBlocks(
  baselineContent: string,
  blocks: FileReviewBlock[]
): { content: string; success: boolean } {
  if (blocks.length === 0) {
    return { content: baselineContent, success: true };
  }

  const patches = blocks
    .slice()
    .sort((left, right) => left.baselineStart - right.baselineStart)
    .flatMap((block) => dmp.patch_fromText(block.patchText));

  const [content, applied] = dmp.patch_apply(patches, baselineContent);
  return {
    content,
    success: applied.every(Boolean),
  };
}