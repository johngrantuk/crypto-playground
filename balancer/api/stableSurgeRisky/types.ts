import Decimal from 'decimal.js';

export type GqlChain =
    | 'ARBITRUM'
    | 'AVALANCHE'
    | 'BASE'
    | 'GNOSIS'
    | 'HYPEREVM'
    | 'MAINNET'
    | 'MONAD'
    | 'OPTIMISM'
    | 'PLASMA';

export type ExclusionPath = 'token_pair' | 'aggressive_surge' | null;

export interface PoolHookDynamicData {
    maxSurgeFeePercentage?: string | null;
    surgeThresholdPercentage?: string | null;
}

export interface PoolHook {
    type?: string | null;
    address?: string | null;
    dynamicData?: PoolHookDynamicData | null;
}

export interface PoolToken {
    address: string;
}

export interface PoolDynamicData {
    totalLiquidity?: string | null;
    volume24h?: string | null;
    isPaused?: boolean | null;
    isInRecoveryMode?: boolean | null;
}

export interface StablePool {
    address: string;
    chain: GqlChain;
    hook?: PoolHook | null;
    poolTokens: PoolToken[];
    dynamicData?: PoolDynamicData | null;
}

export interface AuditPoolInputs {
    maxSurgeFeePercentage: string | null;
    surgeThresholdPercentage: string | null;
    feeSurgeRatio: string;
    hasWrappedNative: boolean;
    hasNonNative: boolean;
}

export interface AuditPoolRow {
    pool: string;
    chain: GqlChain;
    chainId: number;
    owner: string | null;
    balancerUrl: string;
    hookType: string | null;
    surge_excluded: boolean;
    exclusion_path: ExclusionPath;
    reason: 'surge_risky' | null;
    metrics: {
        totalLiquidity: string | null;
        volume24h: string | null;
    };
    inputs: AuditPoolInputs;
    context: {
        isPoolPaused: boolean;
        isPoolInRecoveryMode: boolean;
    };
}

export interface AuditOutput {
    specVersion: '2.0.0';
    activeChains: GqlChain[];
    totals: { evaluated: number; risky: number };
    pools: AuditPoolRow[];
}

export interface ProtocolMetricsChain {
    chainId: string;
    poolCount: string | number;
}

export interface IsRiskyResult {
    excluded: boolean;
    path: ExclusionPath;
}

export type { Decimal };
