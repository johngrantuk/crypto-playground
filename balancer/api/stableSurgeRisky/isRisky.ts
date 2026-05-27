import Decimal from 'decimal.js';
import { nonNativesByChain } from './nonNatives';
import { wrappedNativeByChain } from './wrappedNatives';
import { ExclusionPath, IsRiskyResult } from './types';

export const ACCEPTABLE_MAX_SURGE_FEE = new Decimal('0.1');
export const ACCEPTABLE_FEE_SURGE_RATIO = new Decimal('0.1');

export function parseApiPercentage(
    value: string | null | undefined
): Decimal | null {
    if (value == null || value === '') {
        return null;
    }
    try {
        return new Decimal(value);
    } catch {
        return null;
    }
}

export function calculateFeeSurgeRatio(
    max: Decimal | null,
    threshold: Decimal | null
): Decimal {
    if (max == null || threshold == null || threshold.gte(1)) {
        return new Decimal(0);
    }
    return max.div(new Decimal(1).minus(threshold));
}

export function scanTokenPairFlags(
    tokens: string[],
    chainId: number
): { hasWrappedNative: boolean; hasNonNative: boolean } {
    const wrapped = wrappedNativeByChain.get(chainId);
    const allow = nonNativesByChain.get(chainId) ?? new Set<string>();
    let hasWrappedNative = false;
    let hasNonNative = false;

    for (const t of tokens) {
        if (wrapped && t === wrapped) {
            hasWrappedNative = true;
        } else if (allow.has(t)) {
            hasNonNative = true;
        }
    }

    return { hasWrappedNative, hasNonNative };
}

export function isRiskyWithPath(
    max: Decimal | null,
    threshold: Decimal | null,
    tokens: string[],
    chainId: number
): IsRiskyResult {
    const wrapped = wrappedNativeByChain.get(chainId);
    const allow = nonNativesByChain.get(chainId) ?? new Set<string>();
    let hasWrappedNative = false;
    let hasNonNative = false;

    for (const t of tokens) {
        if (wrapped && t === wrapped) {
            if (hasNonNative) {
                return { excluded: true, path: 'token_pair' };
            }
            hasWrappedNative = true;
        } else if (allow.has(t)) {
            if (hasWrappedNative) {
                return { excluded: true, path: 'token_pair' };
            }
            hasNonNative = true;
        }
    }

    if (max == null || threshold == null) {
        return { excluded: false, path: null };
    }

    const ratio = calculateFeeSurgeRatio(max, threshold);
    if (
        max.lte(ACCEPTABLE_MAX_SURGE_FEE) &&
        ratio.lte(ACCEPTABLE_FEE_SURGE_RATIO)
    ) {
        return { excluded: false, path: null };
    }

    return { excluded: true, path: 'aggressive_surge' };
}

export function decimalToApiString(value: Decimal | null): string | null {
    if (value == null) {
        return null;
    }
    return value.toString();
}

export type { ExclusionPath };
