import { pricePointAtOrBefore } from './priceAtOrBefore';
import type {
    AddRemoveEvent,
    EventValuation,
    EventTokenValuation,
    PricePoint,
    ValueUsdWarning,
} from './types';

function tokenKey(address: string): string {
    return address.trim().toLowerCase();
}

export function parseHumanAmountString(amount: string): number {
    const n = Number(amount);
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid human amount: ${amount}`);
    }
    return n;
}

export function deviationBps(reconstructedUsd: number, valueUsdApi: number): number {
    const denom = Math.max(Math.abs(valueUsdApi), 1e-9);
    return (Math.abs(reconstructedUsd - valueUsdApi) / denom) * 10000;
}

export function valueEvent(params: {
    event: AddRemoveEvent;
    priceMap: Map<string, PricePoint[]>;
}): { reconstructedUsd: number; tokenValuations: EventTokenValuation[] } | { error: string } {
    const { event, priceMap } = params;
    let reconstructedUsd = 0;
    const tokenValuations: EventTokenValuation[] = [];

    for (const leg of event.tokens) {
        const key = tokenKey(leg.address);
        const series = priceMap.get(key);
        if (!series || series.length === 0) {
            return {
                error: `No historical price series for token ${leg.address} (pool event ${event.id})`,
            };
        }
        const point = pricePointAtOrBefore(series, event.timestamp);
        if (point === null) {
            return {
                error: `No as-of price for token ${leg.address} at timestamp ${event.timestamp} (event ${event.id}); series starts at ${series[0]?.timestamp}`,
            };
        }
        const amt = parseHumanAmountString(leg.amount);
        const px = point.price;
        const usdContribution = amt * px;
        reconstructedUsd += usdContribution;
        tokenValuations.push({
            address: key,
            amount: amt,
            priceTimestamp: event.timestamp,
            matchedPricePointTimestamp: point.timestamp,
            priceUsdAtEvent: px,
            usdContribution,
        });
    }

    return { reconstructedUsd, tokenValuations };
}

export function buildEventValuations(params: {
    events: AddRemoveEvent[];
    priceMap: Map<string, PricePoint[]>;
    warningThresholdBps: number;
    poolId: string;
}): {
    valuations: EventValuation[];
    warnings: ValueUsdWarning[];
    exclusion?: { reason: string; detail: string };
} {
    const { events, priceMap, warningThresholdBps, poolId } = params;
    const valuations: EventValuation[] = [];
    const warnings: ValueUsdWarning[] = [];

    for (const event of events) {
        const v = valueEvent({ event, priceMap });
        if ('error' in v) {
            return {
                valuations: [],
                warnings: [],
                exclusion: { reason: 'missing_or_stale_price', detail: v.error },
            };
        }
        const reconstructedUsd = v.reconstructedUsd;
        const valueUsdApi = event.valueUSD;
        const dev = deviationBps(reconstructedUsd, valueUsdApi);

        valuations.push({
            eventId: event.id,
            poolId,
            tx: event.tx,
            type: event.type,
            blockNumber: event.blockNumber,
            timestamp: event.timestamp,
            reconstructedUsd,
            valueUsdApi,
            deviationBps: dev,
            tokenValuations: v.tokenValuations,
        });

        if (dev > warningThresholdBps) {
            warnings.push({
                poolId,
                eventId: event.id,
                tx: event.tx,
                deviationBps: dev,
                reconstructedUsd,
                valueUsdApi,
            });
        }
    }

    return { valuations, warnings };
}
