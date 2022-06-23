import dotenv from 'dotenv';
import { parseFixed } from '@ethersproject/bignumber';
import _ from 'lodash';
import {
    SwapType,
    BalancerSdkConfig,
    Network,
    BalancerSDK,
} from '@balancer-labs/sdk';

import {
    BalancerV2SwapInfoCache,
    ChainId,
    BalancerSwapInfo,
} from './balancer_v2_utils';

dotenv.config();

/**
 * Simulates a call to batchSwap, returning an array of Vault asset deltas.
 * Note - only works for a single tokenIn > tokenOut swap sequence (can be multihop)
 * @param {BalancerSwapInfo} swapInfo Swap steps and assets.
 * @param swapType either exactIn or exactOut.
 * @param swapAmount Amount for first swap in sequence.
 * @param chainId Chain ID.
 * @returns Vault asset deltas. Positive amounts represent tokens sent to the Vault, and negative amounts represent tokens sent by the Vault.
 */
async function queryBatchSwap(
    swapInfo: BalancerSwapInfo,
    swapType: SwapType,
    swapAmount: string,
    chainId: number
): Promise<string[]> {
    const config: BalancerSdkConfig = {
        network: Network[ChainId[chainId]],
        rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    };
    const balancerSdk = new BalancerSDK(config);
    // Replaces amount for first swap in sequence.
    swapInfo.swapSteps[0].amount = swapAmount;
    return await balancerSdk.swaps.queryBatchSwap({
        kind: swapType,
        swaps: swapInfo.swapSteps,
        assets: swapInfo.assets,
    });
}

/**
 * Examples showing how core 0x functions can be used. Has basic benchmarking.
 * Add a root .env file with INFURA=your-infura-key
 * Run using: ts-node balancer/0x/example.ts
 */
async function example(): Promise<void> {
    console.log('Running example...');
    // BAL/WETH has most paths so this is worst case in terms of processing
    const takerToken = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const makerToken = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
    const balancerV2 = new BalancerV2SwapInfoCache(ChainId.MAINNET);

    // This funtion is normally called as part of the constructor
    // Will cache swap info for every token pair combo
    console.time('_loadTopPoolsAsync');
    await balancerV2._loadTopPoolsAsync();
    console.timeEnd('_loadTopPoolsAsync');

    // Retrieves and caches latest swap info for a token pair
    console.log(`_fetchSwapInfoForPairAsync...`);
    console.time('_fetchSwapInfoForPairAsync');
    const swaps = await balancerV2._getAndSaveFreshSwapInfoForPairAsync(
        takerToken,
        makerToken
    );
    console.timeEnd('_fetchSwapInfoForPairAsync');
    console.log(`SwapInfo:`);
    swaps.swapInfoExactIn.forEach((s, i) => {
        console.log(`Swap ${i}`);
        console.log(s.swapSteps);
        console.log(s.assets);
    });

    // Retrieve cached swap info for pair - this get info for ExactIn and ExactOut swap types
    console.log(`Cached WETH/BAL:`);
    const cachedSwaps = balancerV2.getCachedSwapInfoForPair(
        takerToken,
        makerToken
    );
    // cached info should be same as original retrieved
    console.log(
        `Cache is equal: ${_.isEqual(
            swaps.swapInfoExactIn,
            cachedSwaps.swapInfoExactIn
        )}`
    );
    console.log(
        `Cache is equal: ${_.isEqual(
            swaps.swapInfoExactOut,
            cachedSwaps.swapInfoExactOut
        )}`
    );

    // Can use swap info and queryBatchSwap to get price info
    const swapAmount = parseFixed('1', 18);
    const amountsOut = [];
    // ExactIn swaps
    for (let i = 0; i < cachedSwaps.swapInfoExactIn.length; i++) {
        try {
            console.log(i)
            const deltas = await queryBatchSwap(
                cachedSwaps.swapInfoExactIn[i],
                SwapType.SwapExactIn,
                swapAmount.toString(),
                ChainId.MAINNET
            );
            console.log(deltas.toString());
            amountsOut.push(deltas[deltas.length - 1].split('-')[1]);
        } catch (err) {
            console.log(`Not valid: ${err}`);
        }
    }
    // console.log('ExactOut:');
    // // ExactOut swaps
    // for (let i = 0; i < cachedSwaps.swapInfoExactOut.length; i++) {
    //     const deltas = await queryBatchSwap(
    //         cachedSwaps.swapInfoExactOut[i],
    //         SwapType.SwapExactOut,
    //         amountsOut[i],
    //         ChainId.MAINNET
    //     );
    //     console.log(deltas.toString());
    // }
}

example();
