import type { PricePoint } from './types';

/** Build ascending-by-timestamp series for as-of lookup. */
export function prepareSortedPriceSeries(
    prices: Array<{ timestamp: string | number; price: number }>
): PricePoint[] {
    return [...prices]
        .map((p) => ({
            timestamp: Number(p.timestamp),
            price: Number(p.price),
        }))
        .filter(
            (p) =>
                Number.isFinite(p.timestamp) &&
                Number.isFinite(p.price) &&
                p.timestamp >= 0
        )
        .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Last known price with timestamp <= eventTs (no lookahead).
 * Returns null if event is before the first sample.
 */
export function priceUsdAtOrBefore(
    seriesAsc: PricePoint[],
    eventTs: number
): number | null {
    if (seriesAsc.length === 0) {
        return null;
    }
    let lo = 0;
    let hi = seriesAsc.length - 1;
    let ans = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (seriesAsc[mid].timestamp <= eventTs) {
            ans = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    if (ans < 0) {
        return null;
    }
    return seriesAsc[ans].price;
}
