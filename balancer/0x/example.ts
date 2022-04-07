import dotenv from 'dotenv';
import { parseFixed } from '@ethersproject/bignumber';
import _ from 'lodash';
import { SwapType } from '@balancer-labs/sdk';

import { BalancerV2SwapInfoCache, ChainId } from './balancer_v2_utils';

dotenv.config();

/**
 * Examples showing how core 0x functions can be used. Has basic benchmarking.
 * Add a root .env file with INFURA=your-infura-key
 * Run using: ts-node balancer/0x/example.ts
 */
async function example(): Promise<void> {
    console.log('Running example...');
    // BAL/WETH has most paths so this is worst case in terms of processing
    const takerToken = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
    const makerToken = '0xba100000625a3754423978a60c9317c58a424e3d';
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
    swaps.swapInfoExactIn.forEach((s) => {
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
        const deltas = await balancerV2.queryBatchSwap(
            cachedSwaps.swapInfoExactIn[i],
            SwapType.SwapExactIn,
            swapAmount.toString()
        );
        console.log(deltas.toString());
        amountsOut.push(deltas[deltas.length - 1].split('-')[1]);
    }

    // ExactOut swaps
    for (let i = 0; i < cachedSwaps.swapInfoExactOut.length; i++) {
        const deltas = await balancerV2.queryBatchSwap(
            cachedSwaps.swapInfoExactOut[i],
            SwapType.SwapExactOut,
            amountsOut[i]
        );
        console.log(deltas.toString());
    }
}

example();
