/**
 * codeDiff.ts — pure TypeScript line-level diff (Myers algorithm variant)
 * No external dependencies. Used by DiffViewer component.
 */

export type DiffType = 'added' | 'removed' | 'unchanged';

export interface DiffLine {
    type: DiffType;
    content: string;
    originalLineNo: number | null;
    newLineNo: number | null;
}

export interface DiffStats {
    added: number;
    removed: number;
    unchanged: number;
    changePercent: number;
}

// ---------------------------------------------------------------------------
// LCS-based diff (simplified Myers)
// ---------------------------------------------------------------------------

function lcs(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp;
}

function backtrack(
    dp: number[][],
    a: string[],
    b: string[],
    i: number,
    j: number,
    result: DiffLine[],
    origLine: { val: number },
    newLine: { val: number },
): void {
    if (i === 0 && j === 0) return;

    if (i === 0) {
        backtrack(dp, a, b, i, j - 1, result, origLine, newLine);
        result.push({ type: 'added', content: b[j - 1], originalLineNo: null, newLineNo: newLine.val++ });
    } else if (j === 0) {
        backtrack(dp, a, b, i - 1, j, result, origLine, newLine);
        result.push({ type: 'removed', content: a[i - 1], originalLineNo: origLine.val++, newLineNo: null });
    } else if (a[i - 1] === b[j - 1]) {
        backtrack(dp, a, b, i - 1, j - 1, result, origLine, newLine);
        result.push({ type: 'unchanged', content: a[i - 1], originalLineNo: origLine.val++, newLineNo: newLine.val++ });
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        backtrack(dp, a, b, i - 1, j, result, origLine, newLine);
        result.push({ type: 'removed', content: a[i - 1], originalLineNo: origLine.val++, newLineNo: null });
    } else {
        backtrack(dp, a, b, i, j - 1, result, origLine, newLine);
        result.push({ type: 'added', content: b[j - 1], originalLineNo: null, newLineNo: newLine.val++ });
    }
}

// Stack-based to avoid maximum call stack exceeded on large files
function diffLinesIterative(original: string[], optimized: string[]): DiffLine[] {
    const result: DiffLine[] = [];

    // For very large files, do a simpler diff to stay performant
    const MAX_LINES = 300;
    const a = original.slice(0, MAX_LINES);
    const b = optimized.slice(0, MAX_LINES);

    const dp = lcs(a, b);

    let i = a.length;
    let j = b.length;
    const origLine = { val: 1 };
    const newLine = { val: 1 };

    // Iterative backtrack
    const ops: Array<{ i: number; j: number }> = [];
    while (i > 0 || j > 0) {
        if (i === 0) {
            ops.push({ i: 0, j });
            j--;
        } else if (j === 0) {
            ops.push({ i, j: 0 });
            i--;
        } else if (a[i - 1] === b[j - 1]) {
            ops.push({ i, j });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            ops.push({ i, j: -1 }); // removal marker
            i--;
        } else {
            ops.push({ i: -1, j }); // addition marker
            j--;
        }
    }

    ops.reverse();
    for (const op of ops) {
        if (op.i === 0 && op.j > 0) {
            result.push({ type: 'added', content: b[op.j - 1], originalLineNo: null, newLineNo: newLine.val++ });
        } else if (op.j === 0 && op.i > 0) {
            result.push({ type: 'removed', content: a[op.i - 1], originalLineNo: origLine.val++, newLineNo: null });
        } else if (op.j === -1) {
            result.push({ type: 'removed', content: a[op.i - 1], originalLineNo: origLine.val++, newLineNo: null });
        } else if (op.i === -1) {
            result.push({ type: 'added', content: b[op.j - 1], originalLineNo: null, newLineNo: newLine.val++ });
        } else {
            result.push({ type: 'unchanged', content: a[op.i - 1], originalLineNo: origLine.val++, newLineNo: newLine.val++ });
        }
    }

    // Append truncated lines as unchanged if file was cut
    if (original.length > MAX_LINES || optimized.length > MAX_LINES) {
        result.push({
            type: 'unchanged',
            content: `... (${Math.max(original.length, optimized.length) - MAX_LINES} more lines not shown in diff)`,
            originalLineNo: null,
            newLineNo: null,
        });
    }

    return result;
}

export function computeDiff(original: string, optimized: string): DiffLine[] {
    const a = original.split('\n');
    const b = optimized.split('\n');
    return diffLinesIterative(a, b);
}

export function computeDiffStats(diff: DiffLine[]): DiffStats {
    const added = diff.filter(d => d.type === 'added').length;
    const removed = diff.filter(d => d.type === 'removed').length;
    const unchanged = diff.filter(d => d.type === 'unchanged').length;
    const total = added + removed + unchanged;
    const changePercent = total > 0 ? Math.round(((added + removed) / total) * 100) : 0;
    return { added, removed, unchanged, changePercent };
}
