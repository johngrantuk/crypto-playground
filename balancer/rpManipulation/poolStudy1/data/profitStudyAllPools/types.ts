/** Pool row from fetchPoolDynamicDataByNetwork.base.results.json */
export type PoolListEntry = {
    poolAddress: string;
    poolId: string;
    protocolVersion: number;
    dynamicData?: Record<string, unknown>;
    balancerUrl?: string;
};

/** Add/remove event after client-side filter (human-readable amounts per Balancer API). */
export type AddRemoveEvent = {
    id: string;
    poolId: string;
    tx: string;
    type: 'ADD' | 'REMOVE';
    blockNumber: number;
    timestamp: number;
    sender: string;
    valueUSD: number;
    tokens: Array<{ address: string; amount: string }>;
};

export type PricePoint = {
    timestamp: number;
    price: number;
};

export type EventValuation = {
    eventId: string;
    poolId: string;
    tx: string;
    type: 'ADD' | 'REMOVE';
    blockNumber: number;
    timestamp: number;
    reconstructedUsd: number;
    valueUsdApi: number;
    deviationBps: number;
};

export type PoolIncludedResult = {
    poolId: string;
    poolAddress: string;
    protocolVersion: number;
    addEventCount: number;
    removeEventCount: number;
    capitalInUsd: number;
    capitalOutUsd: number;
    pnlUsd: number;
    hodlBenchmark: {
        evalTimestamp: number;
        hodlValueUsdAtExit: number;
        lpMinusHodlUsd: number;
        lpMinusHodlPct: number;
    };
    events: EventValuation[];
};

export type PoolExcludedResult = {
    poolId: string;
    poolAddress: string;
    protocolVersion: number;
    reason: string;
    detail?: string;
};

export type ValueUsdWarning = {
    poolId: string;
    eventId: string;
    tx: string;
    deviationBps: number;
    reconstructedUsd: number;
    valueUsdApi: number;
};
