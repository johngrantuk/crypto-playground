import { priceUsdAtOrBefore } from './priceAtOrBefore';
import type {
    AddRemoveEvent,
    PoolExcludedResult,
    PoolIncludedResult,
    PoolListEntry,
    PricePoint,
    ValueUsdWarning,
} from './types';
import { buildEventValuations } from './valueAndSanity';

export type PoolAnalysisOk = {
    kind: 'ok';
    result: PoolIncludedResult;
    warnings: ValueUsdWarning[];
};

export type PoolAnalysisExcluded = {
    kind: 'excluded';
    excluded: PoolExcludedResult;
};

export function analyzePool(params: {
    entry: PoolListEntry;
    events: AddRemoveEvent[];
    priceMap: Map<string, PricePoint[]>;
    warningThresholdBps: number;
}): PoolAnalysisOk | PoolAnalysisExcluded {
    const { entry, events, priceMap, warningThresholdBps } = params;
    const poolId = entry.poolId;

    const built = buildEventValuations({
        events,
        priceMap,
        warningThresholdBps,
        poolId,
    });

    if (built.exclusion) {
        return {
            kind: 'excluded',
            excluded: {
                poolId,
                poolAddress: entry.poolAddress,
                protocolVersion: entry.protocolVersion,
                reason: built.exclusion.reason,
                detail: built.exclusion.detail,
            },
        };
    }

    let capitalInUsd = 0;
    let capitalOutUsd = 0;
    let addEventCount = 0;
    let removeEventCount = 0;

    for (const ev of built.valuations) {
        if (ev.type === 'ADD') {
            capitalInUsd += ev.reconstructedUsd;
            addEventCount += 1;
        } else {
            capitalOutUsd += ev.reconstructedUsd;
            removeEventCount += 1;
        }
    }

    if (addEventCount !== 1 || removeEventCount !== 1) {
        return {
            kind: 'excluded',
            excluded: {
                poolId,
                poolAddress: entry.poolAddress,
                protocolVersion: entry.protocolVersion,
                reason: 'not_single_leg',
                detail: `Expected exactly 1 ADD and 1 REMOVE, got ADD=${addEventCount}, REMOVE=${removeEventCount}`,
            },
        };
    }

    const addEvent = events.find((e) => e.type === 'ADD');
    const removeEvent = events.find((e) => e.type === 'REMOVE');
    if (!addEvent || !removeEvent) {
        return {
            kind: 'excluded',
            excluded: {
                poolId,
                poolAddress: entry.poolAddress,
                protocolVersion: entry.protocolVersion,
                reason: 'missing_add_or_remove',
                detail: 'Single-leg assumption requires one ADD event and one REMOVE event',
            },
        };
    }

    const evalTimestamp = removeEvent.timestamp;
    let hodlValueUsdAtExit = 0;
    for (const token of addEvent.tokens) {
        const amount = Number(token.amount);
        if (!Number.isFinite(amount)) {
            return {
                kind: 'excluded',
                excluded: {
                    poolId,
                    poolAddress: entry.poolAddress,
                    protocolVersion: entry.protocolVersion,
                    reason: 'invalid_token_amount',
                    detail: `Invalid amount for token ${token.address} in ADD event ${addEvent.id}: ${token.amount}`,
                },
            };
        }
        const address = token.address.toLowerCase();
        const series = priceMap.get(address);
        if (!series || series.length === 0) {
            return {
                kind: 'excluded',
                excluded: {
                    poolId,
                    poolAddress: entry.poolAddress,
                    protocolVersion: entry.protocolVersion,
                    reason: 'missing_price_series_for_hodl',
                    detail: `No historical series for token ${address}`,
                },
            };
        }
        const px = priceUsdAtOrBefore(series, evalTimestamp);
        if (px === null) {
            return {
                kind: 'excluded',
                excluded: {
                    poolId,
                    poolAddress: entry.poolAddress,
                    protocolVersion: entry.protocolVersion,
                    reason: 'missing_asof_price_for_hodl',
                    detail: `No as-of price for token ${address} at exit timestamp ${evalTimestamp}`,
                },
            };
        }
        hodlValueUsdAtExit += amount * px;
    }
    const lpMinusHodlUsd = capitalOutUsd - hodlValueUsdAtExit;
    const lpMinusHodlPct =
        hodlValueUsdAtExit === 0 ? Number.NaN : (lpMinusHodlUsd / hodlValueUsdAtExit) * 100;

    const result: PoolIncludedResult = {
        poolId,
        poolAddress: entry.poolAddress,
        protocolVersion: entry.protocolVersion,
        addEventCount,
        removeEventCount,
        capitalInUsd: round2(capitalInUsd),
        capitalOutUsd: round2(capitalOutUsd),
        pnlUsd: round2(capitalOutUsd - capitalInUsd),
        hodlBenchmark: {
            evalTimestamp,
            hodlValueUsdAtExit: round2(hodlValueUsdAtExit),
            lpMinusHodlUsd: round2(lpMinusHodlUsd),
            lpMinusHodlPct: round2(lpMinusHodlPct),
        },
        events: built.valuations.map((e) => ({
            ...e,
            reconstructedUsd: round2(e.reconstructedUsd),
            valueUsdApi: round2(e.valueUsdApi),
            deviationBps: round2(e.deviationBps),
            tokenValuations: e.tokenValuations.map((tv) => ({
                address: tv.address,
                amount: round6(tv.amount),
                priceTimestamp: tv.priceTimestamp,
                matchedPricePointTimestamp: tv.matchedPricePointTimestamp,
                priceUsdAtEvent: round6(tv.priceUsdAtEvent),
                usdContribution: round2(tv.usdContribution),
            })),
        })),
    };

    return { kind: 'ok', result, warnings: built.warnings };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
}
