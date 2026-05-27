import Decimal from 'decimal.js';
import { balancerPoolUrl, chainIdForGqlChain } from './chains';
import {
    calculateFeeSurgeRatio,
    decimalToApiString,
    isRiskyWithPath,
    parseApiPercentage,
    scanTokenPairFlags,
} from './isRisky';
import { AuditPoolRow, StablePool } from './types';

export function evaluatePool(pool: StablePool): AuditPoolRow {
    const chainId = chainIdForGqlChain(pool.chain);

    let max: Decimal | null = null;
    let threshold: Decimal | null = null;
    if (pool.hook?.type === 'STABLE_SURGE') {
        max = parseApiPercentage(
            pool.hook.dynamicData?.maxSurgeFeePercentage ?? null
        );
        threshold = parseApiPercentage(
            pool.hook.dynamicData?.surgeThresholdPercentage ?? null
        );
    }

    const tokens = pool.poolTokens.map((t) => t.address.toLowerCase());
    const { excluded, path } = isRiskyWithPath(
        max,
        threshold,
        tokens,
        chainId
    );
    const { hasWrappedNative, hasNonNative } = scanTokenPairFlags(
        tokens,
        chainId
    );
    const feeSurgeRatio = calculateFeeSurgeRatio(max, threshold);
    const poolAddress = pool.address.toLowerCase();

    return {
        pool: poolAddress,
        chain: pool.chain,
        chainId,
        owner: null,
        balancerUrl: balancerPoolUrl(pool.chain, poolAddress),
        hookType: pool.hook?.type ?? null,
        surge_excluded: excluded,
        exclusion_path: path,
        reason: excluded ? 'surge_risky' : null,
        metrics: {
            totalLiquidity: pool.dynamicData?.totalLiquidity ?? null,
            volume24h: pool.dynamicData?.volume24h ?? null,
        },
        inputs: {
            maxSurgeFeePercentage: decimalToApiString(max),
            surgeThresholdPercentage: decimalToApiString(threshold),
            feeSurgeRatio: feeSurgeRatio.toString(),
            hasWrappedNative,
            hasNonNative,
        },
        context: {
            isPoolPaused: pool.dynamicData?.isPaused ?? false,
            isPoolInRecoveryMode: pool.dynamicData?.isInRecoveryMode ?? false,
        },
    };
}
