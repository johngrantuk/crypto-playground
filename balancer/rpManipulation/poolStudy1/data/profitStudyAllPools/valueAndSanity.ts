import { priceUsdAtOrBefore } from './priceAtOrBefore';
import type {
    AddRemoveEvent,
    EventValuation,
    PricePoint,
    ValueUsdWarning,
} from './types';

function tokenKey(address: string): string {
    return address.trim().toLowerCase();
}

/**
 * Balancer pool event `tokens[].amount` is human-notional (not raw wei). Parse as float as-is.
 */
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
}): { reconstructedUsd: number } | { error: string } {
    const { event, priceMap } = params;
    let reconstructedUsd = 0;

    for (const leg of event.tokens) {
        const key = tokenKey(leg.address);
        const series = priceMap.get(key);
        if (!series || series.length === 0) {
            return {
                error: `No historical price series for token ${leg.address} (pool event ${event.id})`,
            };
        }
        const px = priceUsdAtOrBefore(series, event.timestamp);
        if (px === null) {
            return {
                error: `No as-of price for token ${leg.address} at timestamp ${event.timestamp} (event ${event.id}); series starts at ${series[0]?.timestamp}`,
            };
        }
        const amt = parseHumanAmountString(leg.amount);
        reconstructedUsd += amt * px;
    }

    return { reconstructedUsd };
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
