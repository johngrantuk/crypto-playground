import { PROFIT_STUDY_CONFIG, type Address } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const viem = require('viem') as {
    createPublicClient: (params: { chain: unknown; transport: unknown }) => any;
    http: (url: string) => unknown;
    parseAbi: (abi: unknown) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chains = require('viem/chains') as { base: unknown };

const { createPublicClient, http, parseAbi } = viem;
const { base } = chains;

const FACTORY_ABI = parseAbi([
    'function getPool(address tokenA,address tokenB,uint24 fee) view returns (address)',
]);
const POOL_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function slot0() view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)',
    'function observe(uint32[] secondsAgos) view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)',
]);

type PriceSource = 'spot' | 'twap';

export type PriceSelection = {
    blockNumber: bigint;
    priceUsdPerWeth: number;
    spotUsdPerWeth: number;
    twapUsdPerWeth: number;
    selectedSource: PriceSource;
    deviationBps: number;
    thresholdBps: number;
    twapWindowSeconds: number;
};

type UniswapContext = {
    client: any;
    poolAddress: Address;
    token0: Address;
    token1: Address;
};

const Q96 = 2n ** 96n;
const Q192 = Q96 * Q96;
const TEN_30 = 10n ** 30n;

function toAddress(addr: string): Address {
    return addr.toLowerCase() as Address;
}

function getUsdPerWethX18FromSqrtPrice(params: {
    sqrtPriceX96: bigint;
    token0: Address;
    token1: Address;
}): bigint {
    const { sqrtPriceX96, token0, token1 } = params;
    const t0 = token0.toLowerCase();
    const t1 = token1.toLowerCase();
    const weth = PROFIT_STUDY_CONFIG.tokenWeth.toLowerCase();
    const usdc = PROFIT_STUDY_CONFIG.tokenUsdc.toLowerCase();

    if (!((t0 === weth && t1 === usdc) || (t0 === usdc && t1 === weth))) {
        throw new Error('Uniswap pool token pair mismatch; expected WETH/USDC');
    }

    const s2 = sqrtPriceX96 * sqrtPriceX96;
    if (t0 === weth) {
        return (s2 * TEN_30) / Q192;
    }
    return (TEN_30 * Q192) / s2;
}

function x18ToNumber(x18: bigint): number {
    return Number(x18) / 1e18;
}

function arithmeticMeanTick(tickDelta: bigint, windowSeconds: number): number {
    const window = BigInt(windowSeconds);
    let meanTick = tickDelta / window;
    // Match Uniswap's negative rounding behavior for mean tick.
    if (tickDelta < 0n && tickDelta % window !== 0n) {
        meanTick -= 1n;
    }
    return Number(meanTick);
}

function getUsdPerWethFromTick(params: {
    tick: number;
    token0: Address;
    token1: Address;
}): number {
    const { tick, token0, token1 } = params;
    const token0Lower = token0.toLowerCase();
    const token1Lower = token1.toLowerCase();
    const weth = PROFIT_STUDY_CONFIG.tokenWeth.toLowerCase();
    const usdc = PROFIT_STUDY_CONFIG.tokenUsdc.toLowerCase();
    const rawPriceToken1PerToken0 = Math.pow(1.0001, tick);
    const decimalScale = Math.pow(10, 18 - 6); // WETH(18), USDC(6)

    if (token0Lower === weth && token1Lower === usdc) {
        return rawPriceToken1PerToken0 * decimalScale;
    }
    if (token0Lower === usdc && token1Lower === weth) {
        return 1 / (rawPriceToken1PerToken0 * decimalScale);
    }
    throw new Error('Uniswap pool token pair mismatch; expected WETH/USDC');
}

function calcDeviationBps(a: number, b: number): number {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) {
        return Number.POSITIVE_INFINITY;
    }
    return (Math.abs(a - b) / Math.abs(b)) * 10000;
}

async function buildContext(): Promise<UniswapContext> {
    const client = createPublicClient({
        chain: base,
        transport: http(PROFIT_STUDY_CONFIG.baseRpcUrl),
    });
    const poolAddress = (await client.readContract({
        address: PROFIT_STUDY_CONFIG.uniswapFactory,
        abi: FACTORY_ABI,
        functionName: 'getPool',
        args: [
            PROFIT_STUDY_CONFIG.tokenWeth,
            PROFIT_STUDY_CONFIG.tokenUsdc,
            PROFIT_STUDY_CONFIG.uniswapFee,
        ],
    })) as Address;
    if (
        !poolAddress ||
        poolAddress === '0x0000000000000000000000000000000000000000'
    ) {
        throw new Error('Uniswap pool not found for configured pair/fee');
    }
    const [token0, token1] = await Promise.all([
        client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'token0',
        }),
        client.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'token1',
        }),
    ]);
    return {
        client,
        poolAddress: toAddress(poolAddress),
        token0: toAddress(token0 as string),
        token1: toAddress(token1 as string),
    };
}

let cachedContext: Promise<UniswapContext> | null = null;
async function getContext(): Promise<UniswapContext> {
    if (!cachedContext) {
        cachedContext = buildContext();
    }
    return cachedContext;
}

export async function fetchUniswapPriceAtBlock(
    blockNumber: bigint
): Promise<PriceSelection> {
    const context = await getContext();
    const { client, poolAddress, token0, token1 } = context;

    const slot0 = await client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'slot0',
        blockNumber,
    });
    const spotSqrt = (slot0.sqrtPriceX96 ?? slot0[0]) as bigint;
    const spotUsdPerWeth = x18ToNumber(
        getUsdPerWethX18FromSqrtPrice({
            sqrtPriceX96: spotSqrt,
            token0,
            token1,
        })
    );

    const window = PROFIT_STUDY_CONFIG.twapWindowSeconds;
    const observe = await client.readContract({
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'observe',
        args: [[window, 0]],
        blockNumber,
    });
    const tickCumulatives = observe.tickCumulatives ?? observe[0];
    if (!Array.isArray(tickCumulatives) || tickCumulatives.length !== 2) {
        throw new Error('Unexpected Uniswap observe return shape');
    }

    const tickDelta = (tickCumulatives[1] as bigint) - (tickCumulatives[0] as bigint);
    const avgTick = arithmeticMeanTick(tickDelta, window);
    const twapUsdPerWeth = getUsdPerWethFromTick({
        tick: avgTick,
        token0,
        token1,
    });

    const deviationBps = calcDeviationBps(spotUsdPerWeth, twapUsdPerWeth);
    const thresholdBps = PROFIT_STUDY_CONFIG.spotTwapDeviationThresholdBps;
    const selectedSource: PriceSource =
        deviationBps > thresholdBps ? 'twap' : 'spot';
    const priceUsdPerWeth =
        selectedSource === 'twap' ? twapUsdPerWeth : spotUsdPerWeth;

    return {
        blockNumber,
        priceUsdPerWeth,
        spotUsdPerWeth,
        twapUsdPerWeth,
        selectedSource,
        deviationBps,
        thresholdBps,
        twapWindowSeconds: window,
    };
}
