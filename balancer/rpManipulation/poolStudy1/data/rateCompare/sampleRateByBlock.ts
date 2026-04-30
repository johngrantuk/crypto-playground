// npx ts-node balancer/rpManipulation/poolStudy1/data/rateCompare/sampleRateByBlock.ts
// Use `require()` for viem imports to avoid TS toolchain incompatibilities.
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const viem = require('viem') as {
    createPublicClient: (params: { chain: unknown; transport: unknown }) => any;
    http: (url: string) => unknown;
    parseAbi: (abi: unknown) => unknown;
    encodeFunctionData: (params: any) => any;
    decodeFunctionResult: (params: any) => any;
    multicall3Abi: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chains = require('viem/chains') as { base: unknown };

const { createPublicClient, http, parseAbi } = viem;
const { multicall3Abi } = viem;
const { base } = chains;
const { encodeFunctionData, decodeFunctionResult } = viem;

type Address = `0x${string}`;

/**
 * Block-by-block sampler for:
 * - Balancer wrapped token rate provider (`getRate()`)
 * - Uniswap v3 WETH/USDC spot price (pool.slot0().sqrtPriceX96, no TWAP)
 * - Chainlink ETH/USD
 * - Pyth ETH/USD stable feed (getPriceNoOlderThan)
 *
 * All normalized into: `usdPerWethX18` = USD per 1 WETH scaled by 1e18.
 */

type MaybeString = string | null;

type Sample = {
    blockNumber: string;
    rateProviderUsdPerWeth: MaybeString;
    uniswapUsdPerWeth: MaybeString;
    chainlinkUsdPerWeth: MaybeString;
    pythUsdPerWeth: MaybeString;
};

// -----------------------------
// Local config.
// -----------------------------
const START_BLOCK = 44713999n;
const END_BLOCK = 44755380n;
const STRIDE = 1n;

// RPC must support `eth_call` with `blockNumber`.
const BASE_RPC_URL = process.env.BASE_RPC_URL;
if (!BASE_RPC_URL) {
    throw new Error('Missing BASE_RPC_URL in environment (.env).');
}

// Output file path. If you edit START/END, also edit OUTPUT_FILE as needed.
const OUTPUT_FILE = `balancer/rpManipulation/poolStudy1/data/rateCompare/rateCompare_${START_BLOCK.toString()}_${END_BLOCK.toString()}.json`;

// Pyth `getPriceNoOlderThan(priceId, age)` where age is a max staleness.
// Large number effectively disables staleness rejection for historical sampling.
const PYTH_MAX_AGE_SECONDS = 60n * 60n * 24n * 365n * 10n; // ~10 years

const LOG_RAW = false;

// Rate provider from `poolStudy1.md`
const RATE_PROVIDER = '0x08e5387e8a0f77dc17316122f3d27d78b3e0a654' as Address;

// Uniswap v3 (Base) WETH/USDC 0.05% pool:
const WETH = '0x4200000000000000000000000000000000000006' as Address;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address;
const UNISWAP_V3_FACTORY =
    '0x33128a8fC17869897dcE68Ed026d694621f6FDfD' as Address;
const UNISWAP_V3_FEE = 500n; // 0.05% => 500

// Chainlink canonical ETH/USD on Base:
const CHAINLINK_ETH_USD_AGGREGATOR =
    '0x57d2d46fc7ff2a7142d479f2f59e1e3f95447077' as Address;

// Pyth stable ETH/USD feed on Base:
const PYTH_CONTRACT = '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a' as Address;
const PYTH_PRICE_ID =
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' as `0x${string}`;

// Base multicall3 address (used only if viem can't auto-resolve).
const MULTICALL3_ADDRESS =
    '0xcA11bde05977b3631167028862bE2a173976CA11' as Address;

// -----------------------------
// ABIs (minimal).
// -----------------------------
const RATE_PROVIDER_ABI = parseAbi([
    'function getRate() view returns (uint256)',
]);

const UNISWAP_FACTORY_ABI = parseAbi([
    'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address)',
]);

const UNISWAP_POOL_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
]);

const CHAINLINK_ABI = parseAbi([
    'function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)',
    'function decimals() view returns (uint8)',
]);

const PYTH_ABI = parseAbi([
    'function getPriceNoOlderThan(bytes32 id,uint256 age) view returns (int64 price,uint64 conf,int32 expo,uint256 publishTime)',
]);

// -----------------------------
// Helpers: math/normalization
// -----------------------------
const TEN_18 = 10n ** 18n;
const TEN_30 = 10n ** 30n;
const Q96 = 2n ** 96n;
const Q192 = Q96 * Q96; // 2^192

function toUsdPerWethX18FromUniswapSlot0(params: {
    sqrtPriceX96: bigint;
    token0: Address;
}): bigint {
    const { sqrtPriceX96, token0 } = params;
    const s2 = sqrtPriceX96 * sqrtPriceX96; // uint256 range is fine for bigint.

    const token0IsWeth = token0.toLowerCase() === WETH.toLowerCase();
    if (token0IsWeth) {
        // usdPerWethX18 = (sqrtPriceX96^2 * 10^30) / 2^192
        return (s2 * TEN_30) / Q192;
    }

    // usdPerWethX18 = (10^30 * 2^192) / sqrtPriceX96^2
    return (TEN_30 * Q192) / s2;
}

function toUsdPerWethX18FromChainlink(params: {
    answer: bigint;
    decimals: number;
}): bigint | null {
    const { answer, decimals } = params;
    if (answer < 0n) return null;
    const den = 10n ** BigInt(decimals);
    return (answer * TEN_18) / den;
}

function toUsdPerWethX18FromPyth(params: {
    price: bigint;
    expo: number | bigint;
}): bigint | null {
    const { price, expo } = params;
    if (price < 0n) return null;

    const expoBig = typeof expo === 'bigint' ? expo : BigInt(expo);
    if (expoBig >= 0n) {
        return price * 10n ** expoBig * TEN_18;
    }
    const absExpo = -expoBig;
    return (price * TEN_18) / 10n ** absExpo;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetries<T>(action: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 750;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            return await action();
        } catch (err) {
            lastErr = err;
            if (attempt === MAX_RETRIES) break;
            // eslint-disable-next-line no-await-in-loop
            await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
        }
    }
    throw lastErr;
}

function maybeToString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'bigint') return value.toString();
    return String(value);
}

function formatX18ToDecimal(value: MaybeString): MaybeString {
    if (value === null) return null;
    const raw = BigInt(value);
    const isNegative = raw < 0n;
    const absRaw = isNegative ? -raw : raw;
    const roundedCents = (absRaw * 100n + TEN_18 / 2n) / TEN_18;
    const whole = roundedCents / 100n;
    const fraction = (roundedCents % 100n).toString().padStart(2, '0');
    const sign = isNegative ? '-' : '';
    return `${sign}${whole.toString()}.${fraction}`;
}

async function multicallWithFallback(params: {
    publicClient: any;
    blockNumber: bigint;
    poolAddress: Address;
}): Promise<Array<{ status: 'success' | 'failure'; result?: any }>> {
    const { publicClient, blockNumber, poolAddress } = params;

    const contracts = [
        {
            address: RATE_PROVIDER,
            abi: RATE_PROVIDER_ABI,
            functionName: 'getRate',
        },
        {
            address: poolAddress,
            abi: UNISWAP_POOL_ABI,
            functionName: 'slot0',
        },
        {
            address: CHAINLINK_ETH_USD_AGGREGATOR,
            abi: CHAINLINK_ABI,
            functionName: 'latestRoundData',
        },
        {
            address: PYTH_CONTRACT,
            abi: PYTH_ABI,
            functionName: 'getPriceNoOlderThan',
            args: [PYTH_PRICE_ID, PYTH_MAX_AGE_SECONDS],
        },
    ];

    // Manual Multicall3.aggregate3 call.
    const calls = contracts.map((c: any) => {
        const callData = encodeFunctionData({
            abi: c.abi,
            functionName: c.functionName,
            args: c.args ?? [],
        });
        return {
            target: c.address,
            allowFailure: true,
            callData,
        };
    });

    const aggregate3Data = encodeFunctionData({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        args: [calls],
    });

    const resp = await publicClient.call({
        to: MULTICALL3_ADDRESS,
        data: aggregate3Data,
        blockNumber,
    });

    const decodedAgg = decodeFunctionResult({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        data: resp.data as `0x${string}`,
    }) as any;

    // multicall3 aggregate3 returns an array of tuples:
    // [{ success: boolean, returnData: bytes }, ...]
    // Depending on decoder shape, normalize into that array.
    const returnTuples: Array<{ success: boolean; returnData: `0x${string}` }> =
        Array.isArray(decodedAgg)
            ? decodedAgg
            : Array.isArray(decodedAgg?.returnData)
            ? decodedAgg.returnData
            : Array.isArray(decodedAgg?.[0])
            ? decodedAgg[0]
            : [];

    const decodedResults: Array<{
        status: 'success' | 'failure';
        result?: any;
    }> = [];

    for (let i = 0; i < contracts.length; i++) {
        const c = contracts[i] as any;
        const tuple = returnTuples[i] as any;
        const data = tuple?.returnData as `0x${string}` | undefined;
        const ok = tuple?.success === true;
        try {
            if (!data || data === '0x') throw new Error('empty returnData');
            const result = decodeFunctionResult({
                abi: c.abi,
                functionName: c.functionName,
                args: c.args ?? [],
                data,
            });
            decodedResults.push({ status: ok ? 'success' : 'failure', result });
        } catch (_decodeErr) {
            decodedResults.push({ status: 'failure' });
        }
    }

    return decodedResults;
}

// -----------------------------
// Main
// -----------------------------
async function main(): Promise<void> {
    if (END_BLOCK < START_BLOCK) {
        throw new Error('END_BLOCK must be >= START_BLOCK');
    }
    if (STRIDE <= 0n) {
        throw new Error('STRIDE must be > 0');
    }

    const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
    });

    // Derive the Uniswap pool address + token0/token1 order.
    const poolAddress = await publicClient.readContract({
        address: UNISWAP_V3_FACTORY,
        abi: UNISWAP_FACTORY_ABI,
        functionName: 'getPool',
        args: [WETH, USDC, UNISWAP_V3_FEE],
    });

    if (
        !poolAddress ||
        poolAddress === '0x0000000000000000000000000000000000000000'
    ) {
        throw new Error('Uniswap v3 pool not found for WETH/USDC fee=500');
    }

    const token0 = await publicClient.readContract({
        address: poolAddress,
        abi: UNISWAP_POOL_ABI,
        functionName: 'token0',
    });

    // token1 isn't needed for the spot math once we know whether token0 is WETH,
    // but reading it is useful for debugging.
    const token1 = await publicClient.readContract({
        address: poolAddress,
        abi: UNISWAP_POOL_ABI,
        functionName: 'token1',
    });

    const chainlinkDecimals = await publicClient.readContract({
        address: CHAINLINK_ETH_USD_AGGREGATOR,
        abi: CHAINLINK_ABI,
        functionName: 'decimals',
    });

    console.log(
        [
            'blockNumber',
            'rateProviderUsdPerWeth',
            'uniswapUsdPerWeth',
            'chainlinkUsdPerWeth',
            'pythUsdPerWeth',
        ].join(',')
    );

    const samples: Sample[] = [];

    for (let b = START_BLOCK; b <= END_BLOCK; b += STRIDE) {
        // Snapshot values at blockTag=b using a single multicall3.
        const results = await callWithRetries(() =>
            multicallWithFallback({
                publicClient,
                blockNumber: b,
                poolAddress,
            })
        );

        const rateCall = results[0];
        const uniswapCall = results[1];
        const chainlinkCall = results[2];
        const pythCall = results[3];

        let rateProviderUsdPerWethX18: MaybeString = null;
        let uniswapUsdPerWethX18: MaybeString = null;
        let chainlinkUsdPerWethX18: MaybeString = null;
        let pythUsdPerWethX18: MaybeString = null;

        if (rateCall.status === 'success') {
            rateProviderUsdPerWethX18 = maybeToString(rateCall.result);
        }

        if (uniswapCall.status === 'success') {
            const slot0 = uniswapCall.result as any;
            const sqrtPriceX96 = (slot0.sqrtPriceX96 ?? slot0[0]) as bigint;
            const usd = toUsdPerWethX18FromUniswapSlot0({
                sqrtPriceX96,
                token0: token0 as Address,
            });
            uniswapUsdPerWethX18 = usd.toString();
        }

        if (chainlinkCall.status === 'success') {
            const latest = chainlinkCall.result as any;
            const answer = latest.answer ?? latest[1];
            const usd = toUsdPerWethX18FromChainlink({
                answer: answer as bigint,
                decimals: chainlinkDecimals as number,
            });
            chainlinkUsdPerWethX18 = usd === null ? null : usd.toString();
        } else {
            // Fallback: direct call for Chainlink if multicall leg failed.
            try {
                const latest = await callWithRetries(() =>
                    publicClient.readContract({
                        address: CHAINLINK_ETH_USD_AGGREGATOR,
                        abi: CHAINLINK_ABI,
                        functionName: 'latestRoundData',
                        blockNumber: b,
                    })
                );
                const latestAny = latest as any;
                const answer = latestAny.answer ?? latestAny[1];
                const usd = toUsdPerWethX18FromChainlink({
                    answer: answer as bigint,
                    decimals: chainlinkDecimals as number,
                });
                chainlinkUsdPerWethX18 = usd === null ? null : usd.toString();
            } catch (_chainlinkErr) {
                chainlinkUsdPerWethX18 = null;
            }
        }

        if (pythCall.status === 'success') {
            const priceData = pythCall.result as any;
            const price = priceData.price ?? priceData[0];
            const expo = priceData.expo ?? priceData[2];
            const usd = toUsdPerWethX18FromPyth({
                price: price as bigint,
                expo,
            });
            pythUsdPerWethX18 = usd === null ? null : usd.toString();
        }

        const row: Sample = {
            blockNumber: b.toString(),
            rateProviderUsdPerWeth: formatX18ToDecimal(
                rateProviderUsdPerWethX18
            ),
            uniswapUsdPerWeth: formatX18ToDecimal(uniswapUsdPerWethX18),
            chainlinkUsdPerWeth: formatX18ToDecimal(chainlinkUsdPerWethX18),
            pythUsdPerWeth: formatX18ToDecimal(pythUsdPerWethX18),
        };

        samples.push(row);
        console.log(
            [
                row.blockNumber,
                row.rateProviderUsdPerWeth ?? '',
                row.uniswapUsdPerWeth ?? '',
                row.chainlinkUsdPerWeth ?? '',
                row.pythUsdPerWeth ?? '',
            ].join(',')
        );

        if (LOG_RAW) {
            console.log(
                JSON.stringify(
                    {
                        poolAddress,
                        token0,
                        token1,
                        raw: {
                            rate: rateCall,
                            uniswap: uniswapCall,
                            chainlink: chainlinkCall,
                            pyth: pythCall,
                        },
                    },
                    null,
                    2
                )
            );
        }

        // Prevent UI from freezing on very large ranges.
        if ((b - START_BLOCK) % (STRIDE * 100n) === 0n) {
            // eslint-disable-next-line no-console
            console.log(`# progress: b=${b.toString()}`);
        }
    }

    mkdirSync('balancer/rpManipulation/poolStudy1/data/rateCompare', {
        recursive: true,
    });
    writeFileSync(OUTPUT_FILE, JSON.stringify(samples, null, 2));
    console.log(`\nWrote ${samples.length} samples to ${OUTPUT_FILE}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
