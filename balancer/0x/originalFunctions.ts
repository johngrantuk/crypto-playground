import { BigNumber, parseFixed } from '@ethersproject/bignumber';

// Taken from original 0x. Used as benchmark comparrison.

export interface Pool {
    id: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
    spotPrice?: BigNumber;
    slippage?: BigNumber;
    limitAmount?: BigNumber;
}

export const parsePoolData = (
    directPools: SubGraphPoolDictionary,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop: SubGraphPool[] = [],
    mostLiquidPoolsSecondHop: SubGraphPool[] = [],
    hopTokens: string[] = []
): [SubGraphPoolDictionary, Path[]] => {
    const pathDataList: Path[] = [];
    const pools: SubGraphPoolDictionary = {};

    // First add direct pair paths
    // tslint:disable-next-line:forin
    for (const idKey in directPools) {
        const p: SubGraphPool = directPools[idKey];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[idKey] = p;

        const swap: Swap = {
            pool: p.id,
            tokenIn,
            tokenOut,
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
        };

        const path: Path = {
            id: p.id,
            swaps: [swap],
        };
        pathDataList.push(path);
    }

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop and mostLiquidPoolsSecondHop always has the same
    // lengh of hopTokens
    for (let i = 0; i < hopTokens.length; i++) {
        // Add pools to the set with all pools (only adds if it's still not present in dict)
        pools[mostLiquidPoolsFirstHop[i].id] = mostLiquidPoolsFirstHop[i];
        pools[mostLiquidPoolsSecondHop[i].id] = mostLiquidPoolsSecondHop[i];

        const swap1: Swap = {
            pool: mostLiquidPoolsFirstHop[i].id,
            tokenIn,
            tokenOut: hopTokens[i],
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
        };

        const swap2: Swap = {
            pool: mostLiquidPoolsSecondHop[i].id,
            tokenIn: hopTokens[i],
            tokenOut,
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
        };

        const path: Path = {
            id: mostLiquidPoolsFirstHop[i].id + mostLiquidPoolsSecondHop[i].id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
            swaps: [swap1, swap2],
        };
        pathDataList.push(path);
    }
    return [pools, pathDataList];
};

function _parseSubgraphPoolData(
    pool: any,
    takerToken: string,
    makerToken: string
): Pool {
    const tToken = pool.tokens.find((t) => t.address === takerToken);
    const mToken = pool.tokens.find((t) => t.address === makerToken);
    const swap = pool.swaps && pool.swaps[0];
    const tokenAmountOut = swap ? swap.tokenAmountOut : undefined;
    const tokenAmountIn = swap ? swap.tokenAmountIn : undefined;
    const spotPrice =
        tokenAmountOut && tokenAmountIn
            ? parseFixed(tokenAmountOut, 18).div(tokenAmountIn)
            : undefined; // TODO: xianny check

    return {
        id: pool.id,
        balanceIn: parseFixed(tToken.balance, 18),
        balanceOut: parseFixed(mToken.balance, 18),
        weightIn: parseFixed(tToken.weight, 18),
        weightOut: parseFixed(mToken.weight, 18),
        swapFee: parseFixed(pool.swapFee, 18),
        spotPrice,
    };
}

export async function _loadTopPoolsAsyncOld(poolDataService): Promise<void> {
    console.time(`_loadTopPoolsAsyncOld`);
    const fromToPools: {
        [from: string]: { [to: string]: boolean[] };
    } = {};

    const pools = await poolDataService.getPools();
    for (const pool of pools) {
        const { tokensList } = pool;
        for (const from of tokensList) {
            for (const to of tokensList.filter(
                (t) => t.toLowerCase() !== from.toLowerCase()
            )) {
                fromToPools[from] = fromToPools[from] || {};
                fromToPools[from][to] = fromToPools[from][to] || [];

                try {
                    // console.log(`OLD: ${from} ${to}`);
                    // console.time('old');
                    // The list of pools must be relevant to `from` and `to`  for `parsePoolData`
                    const [poolData] = parsePoolData(
                        { [pool.id]: pool as any },
                        from,
                        to
                    );
                    const test = _parseSubgraphPoolData(
                        poolData[pool.id],
                        from,
                        to
                    );
                    fromToPools[from][to].push(true);
                    // console.timeEnd('old');

                    // Cache this as we progress through
                    const expiresAt = Date.now() + this._cacheTimeMs;
                    const key = JSON.stringify([from, to]);
                    const _cache = {
                        expiresAt,
                        test,
                    };
                    // this._cachePoolsForPair(
                    //     from,
                    //     to,
                    //     fromToPools[from][to],
                    //     expiresAt
                    // );
                } catch (err) {
                    // console.error(`Failed to load Balancer V2 top pools`, err);
                    // soldier on
                }
            }
        }
    }
    console.timeEnd(`_loadTopPoolsAsyncOld`);
}

interface SubGraphPool {
    id: string;
    swapFee: string;
    totalWeight: string;
    totalShares: string;
    tokens: SubGraphToken[];
    tokensList: string[];
    poolType?: string;

    // Only for stable pools
    amp: string;

    // Only for element pools
    lpShares?: BigNumber;
    time?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}

interface SubGraphPoolDictionary {
    [poolId: string]: SubGraphPool;
}

interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string | number;
    // Stable & Element field
    weight?: string;
}
interface Path {
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData?: PoolPairData[];
    limitAmount?: BigNumber;
    filterEffectivePrice?: BigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
}

interface Swap {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
    tokenInDecimals: number;
    tokenOutDecimals: number;
}

export interface PoolPairData {
    id: string;
    poolType?: string; // Todo: make this a mandatory field?
    pairType?: string; // Todo: make this a mandatory field?
    tokenIn: string;
    tokenOut: string;
    balanceIn?: BigNumber;
    balanceOut?: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    swapFee: BigNumber;

    // For weighted & element pools
    weightIn?: BigNumber;
    weightOut?: BigNumber;

    // Only for stable pools
    allBalances: BigNumber[];
    invariant?: BigNumber;
    amp?: BigNumber;
    tokenIndexIn?: number;
    tokenIndexOut?: number;

    // Only for element pools
    lpShares?: BigNumber;
    time?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}
