// npx ts-node balancer/api/stableSurgeRisky/testVectors.ts
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { isRiskyWithPath } from './isRisky';
import { ExclusionPath } from './types';

const WETH_MAINNET = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const USDC_MAINNET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const RLUSD_MAINNET = '0x8292eea06d369bab12dd03ad9cc9ce2edf755b4';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const EXOTIC_A = '0x1111111111111111111111111111111111111111';
const EXOTIC_B = '0x2222222222222222222222222222222222222222';

interface VectorCase {
    name: string;
    max: string | null;
    threshold: string | null;
    chainId: number;
    tokens: string[];
    expectedExcluded: boolean;
    expectedPath: ExclusionPath;
}

const VECTORS: VectorCase[] = [
    {
        name: 'WETH + USDC, low surge',
        max: '0.05',
        threshold: '0.3',
        chainId: 1,
        tokens: [WETH_MAINNET, USDC_MAINNET],
        expectedExcluded: true,
        expectedPath: 'token_pair',
    },
    {
        name: 'RLUSD + USDC, high surge, no WETH',
        max: '0.95',
        threshold: '0.3',
        chainId: 1,
        tokens: [RLUSD_MAINNET, USDC_MAINNET],
        expectedExcluded: true,
        expectedPath: 'aggressive_surge',
    },
    {
        name: 'RLUSD + USDC, low surge, no WETH',
        max: '0.05',
        threshold: '0.3',
        chainId: 1,
        tokens: [RLUSD_MAINNET, USDC_MAINNET],
        expectedExcluded: false,
        expectedPath: null,
    },
    {
        name: 'Aggressive surge + WETH + Base USDC',
        max: '0.95',
        threshold: '0.3',
        chainId: 8453,
        tokens: [WETH_BASE, USDC_BASE],
        expectedExcluded: true,
        expectedPath: 'token_pair',
    },
    {
        name: 'Missing surge params, no token pair',
        max: null,
        threshold: null,
        chainId: 1,
        tokens: [RLUSD_MAINNET],
        expectedExcluded: false,
        expectedPath: null,
    },
    {
        name: 'Plain stable, WETH + USDC, no hook',
        max: null,
        threshold: null,
        chainId: 1,
        tokens: [WETH_MAINNET, USDC_MAINNET],
        expectedExcluded: true,
        expectedPath: 'token_pair',
    },
    {
        name: 'High surge, tokens not in allowlist, no WETH',
        max: '0.95',
        threshold: '0.3',
        chainId: 1,
        tokens: [EXOTIC_A, EXOTIC_B],
        expectedExcluded: true,
        expectedPath: 'aggressive_surge',
    },
];

function toDecimal(value: string | null): Decimal | null {
    return value == null ? null : new Decimal(value);
}

function main(): void {
    let failures = 0;

    for (const v of VECTORS) {
        const { excluded, path } = isRiskyWithPath(
            toDecimal(v.max),
            toDecimal(v.threshold),
            v.tokens,
            v.chainId
        );

        try {
            assert.equal(excluded, v.expectedExcluded, 'excluded mismatch');
            assert.equal(path, v.expectedPath, 'path mismatch');
            console.log(`PASS: ${v.name}`);
        } catch (err) {
            failures += 1;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(
                `FAIL: ${v.name} — got excluded=${excluded} path=${path}; ${msg}`
            );
        }
    }

    console.log(
        failures === 0
            ? `All ${VECTORS.length} vectors passed`
            : `${failures}/${VECTORS.length} vectors failed`
    );
    process.exit(failures > 0 ? 1 : 0);
}

if (require.main === module) {
    main();
}
