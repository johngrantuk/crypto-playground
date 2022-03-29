import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import {
    BalancerSDK,
    BalancerSdkConfig,
    Network,
    SwapTypes,
    RouteProposer,
    NewPath,
    parseToPoolsDict,
    PoolDictionary,
    formatSequence,
    getTokenAddressesForSwap,
    SwapType,
} from '@balancer-labs/sdk';
import { SubgraphPoolDataService } from './sgPoolDataService';
import { Pool, _loadTopPoolsAsyncOld } from './originalFunctions';

/////////////// Manually added to replace imports
export interface BalancerBatchSwapStep {
    poolId: string;
    assetInIndex: number;
    assetOutIndex: number;
    amount: string;
    userData: string;
}

export interface BalancerSwapInfo {
    assets: string[];
    swapSteps: BalancerBatchSwapStep[];
}

export enum ChainId {
    MAINNET = 1,
    ROPSTEN = 3,
    RINKEBY = 4,
    GÖRLI = 5,
    KOVAN = 42,
    POLYGON = 137,
    ARBITRUM = 42161,
}

export interface CacheValue {
    expiresAt: number;
    swapInfo: BalancerSwapInfo[];
}

export const BALANCER_V2_SUBGRAPH_URL_BY_CHAIN = {
    [ChainId.MAINNET]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
    [ChainId.POLYGON]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
};
////////////////

// tslint:disable-next-line:custom-no-magic-numbers
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class BalancerV2SwapInfoCache {
    _cache: { [key: string]: CacheValue };
    _cacheTimeMs: number = ((60 * 60) / 2) * 1000; // (ONE_HOUR_IN_SECONDS / 2) * ONE_SECOND_MS;

    routeProposer: RouteProposer;
    poolDataService: SubgraphPoolDataService;
    balancerSdk: BalancerSDK;

    constructor(
        chainId: ChainId,
        private readonly subgraphUrl: string = BALANCER_V2_SUBGRAPH_URL_BY_CHAIN[
            chainId
        ]
    ) {
        this._cache = {};
        const config: BalancerSdkConfig = {
            network: Network[ChainId[chainId]],
            rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
        };
        const balancerSdk = new BalancerSDK(config);
        this.balancerSdk = balancerSdk;
        // The RouteProposer finds paths between a token pair using direct/multihop/linearPool routes
        this.routeProposer = balancerSdk.sor.routeProposer;
        // super(cache);
        // Uses Subgraph to retrieve up to date pool data required for routeProposer
        this.poolDataService = new SubgraphPoolDataService({
            chainId: chainId,
            subgraphUrl: this.subgraphUrl,
        });

        // Removed to make manual testing easier (see example.ts)
        // void this._loadTopPoolsAsync();
        // Can be used as a comparrison benchmark
        // void _loadTopPoolsAsyncOld(this.poolDataService);

        // Reload the top pools every 12 hours
        // setInterval(async () => void this._loadTopPoolsAsync(), ONE_DAY_MS / 2);
    }

    /**
     * Given an array of Balancer paths, returns an array of swap information that can be passed to queryBatchSwap.
     * @param {NewPath[]} paths Array of Balancer paths.
     * @returns {BalancerSwapInfo[]} Array of formatted swap data consisting of assets and swap steps.
     */
    private formatSwaps(paths: NewPath[]): BalancerSwapInfo[] {
        const formattedSwaps: BalancerSwapInfo[] = [];
        let assets: string[];
        let swapSteps: BalancerBatchSwapStep[];
        paths.forEach((path) => {
            // Add a swap amount for each swap so we can use formatSequence. (This will be overwritten with actual amount during query)
            path.swaps.forEach((s) => (s.swapAmount = '0'));
            const tokenAddresses = getTokenAddressesForSwap(path.swaps);
            const formatted = formatSequence(
                SwapTypes.SwapExactIn,
                path.swaps,
                tokenAddresses
            );
            assets = tokenAddresses;
            swapSteps = formatted;
            formattedSwaps.push({
                assets,
                swapSteps,
            });
        });
        return formattedSwaps;
    }

    /**
     * Uses pool data from provided dictionary to find top swap paths for token pair.
     * @param {PoolDictionary} pools Dictionary of pool data.
     * @param {string} takerToken Address of taker token.
     * @param {string} makerToken Address of maker token.
     * @returns {BalancerSwapInfo[]} Array of swap data for pair consisting of assets and swap steps.
     */
    private _getPoolPairSwapInfo(
        pools: PoolDictionary,
        takerToken: string,
        makerToken: string
    ): BalancerSwapInfo[] {
        /*
        Uses Balancer SDK to construct available paths for pair.
        Paths can be direct, i.e. both tokens are in same pool or multihop.
        Will also create paths for the new Balancer Linear pools.
        These are returned in order of available liquidity which is useful for filtering.
        */
        const maxPools = 4;
        const paths = this.routeProposer.getCandidatePathsFromDict(
            takerToken,
            makerToken,
            SwapTypes.SwapExactIn,
            pools,
            maxPools
        );

        if (paths.length == 0) return [];

        // Convert paths data to swap information suitable for queryBatchSwap. Only use top 3 liquid paths
        return this.formatSwaps(paths.slice(0, 3));
    }

    async _loadTopPoolsAsync(): Promise<void> {
        console.log(`_loadTopPoolsAsync()`);
        const fromToSwapInfo: {
            [from: string]: { [to: string]: BalancerSwapInfo[] };
        } = {};

        // Retrieve pool data from Subgraph
        const pools = await this.poolDataService.getPools();
        // timestamp is used for Element pools
        const timestamp = Math.floor(Date.now() / 1000);
        const poolsDict = parseToPoolsDict(pools, timestamp);

        for (const pool of pools) {
            const { tokensList } = pool;
            for (const from of tokensList) {
                for (const to of tokensList.filter(
                    (t) => t.toLowerCase() !== from.toLowerCase()
                )) {
                    fromToSwapInfo[from] = fromToSwapInfo[from] || {};
                    // If a record for pair already exists skip as all paths already found
                    if (fromToSwapInfo[from][to]) {
                        continue;
                    } else {
                        try {
                            const expiresAt = Date.now() + this._cacheTimeMs;
                            // Retrieve swap steps and assets for a token pair
                            // This only needs to be called once per pair as all paths will be created from single call
                            const pairSwapInfo = this._getPoolPairSwapInfo(
                                poolsDict,
                                from,
                                to
                            );
                            fromToSwapInfo[from][to] = pairSwapInfo;
                            this._cacheSwapInfoForPair(
                                from,
                                to,
                                fromToSwapInfo[from][to],
                                expiresAt
                            );
                        } catch (err) {
                            console.error(
                                `Failed to load Balancer V2 top pools`,
                                err
                            );
                            // soldier on
                        }
                    }
                }
            }
        }
        console.log(`_loadTopPoolsAsync() - Pools Loaded`);
    }

    protected _cacheSwapInfoForPair(
        takerToken: string,
        makerToken: string,
        swapInfo: BalancerSwapInfo[],
        expiresAt: number
    ): void {
        const key = JSON.stringify([takerToken, makerToken]);
        this._cache[key] = {
            expiresAt,
            swapInfo,
        };
    }

    public getCachedSwapInfoForPair(
        takerToken: string,
        makerToken: string,
        ignoreExpired = true
    ): BalancerSwapInfo[] | undefined {
        const key = JSON.stringify([takerToken, makerToken]);
        const value = this._cache[key];
        if (ignoreExpired) {
            return value === undefined ? [] : value.swapInfo;
        }
        if (!value) {
            return undefined;
        }
        // if (SwapInfoCache._isExpired(value)) {
        //     return undefined;
        // }
        return value.swapInfo;
    }

    /**
     * Will retrieve fresh pair and path data from Subgraph and return and array of swap info for pair..
     * @param {string} takerToken Address of takerToken.
     * @param {string} makerToken Address of makerToken.
     * @returns {BalancerSwapInfo[]} Array of swap data for pair consisting of assets and swap steps.
     */
    protected async _fetchSwapInfoForPairAsync(
        takerToken: string,
        makerToken: string
    ): Promise<BalancerSwapInfo[]> {
        try {
            // retrieve up to date pools from SG
            console.time('SG');
            const pools = await this.poolDataService.getPools();
            console.timeEnd('SG');

            // timestamp is used for Element pools
            const timestamp = Math.floor(Date.now() / 1000);
            const poolDictionary = parseToPoolsDict(pools, timestamp);
            return this._getPoolPairSwapInfo(
                poolDictionary,
                takerToken,
                makerToken
            );
        } catch (e) {
            return [];
        }
    }

    /**
     * Returns an array of swap info for pair. Will retrieve fresh pool data if cache has expired.
     * @param {string} takerToken Address of takerToken.
     * @param {string} makerToken Address of makerToken.
     * @returns {BalancerSwapInfo[]} Array of swap data for pair consisting of assets and swap steps.
     */
    async _getAndSaveFreshSwapInfoForPairAsync(
        takerToken: string,
        makerToken: string
    ): Promise<BalancerSwapInfo[]> {
        const key = JSON.stringify([takerToken, makerToken]);
        const value = this._cache[key];
        if (value === undefined || value.expiresAt >= Date.now()) {
            const pools = await this._fetchSwapInfoForPairAsync(
                takerToken,
                makerToken
            );
            const expiresAt = Date.now() + this._cacheTimeMs;
            this._cacheSwapInfoForPair(
                takerToken,
                makerToken,
                pools,
                expiresAt
            );
        }
        return this._cache[key].swapInfo;
    }

    /**
     * Simulates a call to batchSwap, returning an array of Vault asset deltas.
     * Note - only works for a single tokenIn > tokenOut swap sequence (can be multihop)
     * @param {BalancerSwapInfo} swapInfo Swap steps and assets.
     * @param swapType either exactIn or exactOut.
     * @param swapAmount Amount for first swap in sequence.
     * @returns Vault asset deltas. Positive amounts represent tokens sent to the Vault, and negative amounts represent tokens sent by the Vault.
     */
    async queryBatchSwap(
        swapInfo: BalancerSwapInfo,
        swapType: SwapType,
        swapAmount: string
    ): Promise<string[]> {
        // Replaces amount for first swap in sequence.
        swapInfo.swapSteps[0].amount = swapAmount;
        return await this.balancerSdk.swaps.queryBatchSwap({
            kind: swapType,
            swaps: swapInfo.swapSteps,
            assets: swapInfo.assets,
        });
    }
}
