/*
Phantom pools allow for join/exit of pool using swaps.
One possible way to find BPT out for tokens in is to queryBatchSwap for each token swap.
*/
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { parseFixed, BigNumberish } from '@ethersproject/bignumber';
import { SOR, SwapInfo, SwapTypes } from 'sor-linear';

import { PROVIDER_URLS, Network } from '../constants/network';
import { SUBGRAPH_URLS } from '../constants/subgraph';
import {
    balancerVault,
    AAVE_DAI,
    AAVE_USDC,
    AAVE_USDT,
    STABAL3PHANTOM,
} from '../constants/addresses';
import { Swap } from './types';
import { queryBatchSwap } from './queryBatchSwap';

import vaultAbi from '../abi/Vault.json';

// Setup - generic setup of provider/SOR, etc.
async function setUp(): Promise<[SOR, Contract]> {
    const networkId = Network.KOVAN;
    const subgraphUrl = SUBGRAPH_URLS[networkId];
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const vaultContract = new Contract(balancerVault, vaultAbi, provider);

    const sor = new SOR(provider, networkId, subgraphUrl);

    // Will get pool info from SG without querying onChain
    // TO DO - This could be more efficient if pool data is already available?
    await sor.fetchPools([], false);
    return [sor, vaultContract];
}

/*
Use SOR to get swapInfo for tokenIn>tokenOut.
SwapInfos.swaps has path information.
*/
async function getSorSwapInfo(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    amount: string,
    sor: SOR
): Promise<SwapInfo> {
    const swapInfo = await sor.getSwaps(tokenIn, tokenOut, swapType, amount);
    return swapInfo;
}

/*
Format multiple individual swaps/assets into a single swap/asset.
*/
function batchSwaps(
    assetArray: string[][],
    swaps: Swap[][]
): { swaps: Swap[]; assets: string[] } {
    // assest addresses without duplicates
    const newAssetArray = [...new Set(assetArray.flat())];

    // Update indices of each swap to use new asset array
    swaps.forEach((swap, i) => {
        swap.forEach((poolSwap) => {
            poolSwap.assetInIndex = newAssetArray.indexOf(
                assetArray[i][poolSwap.assetInIndex]
            );
            poolSwap.assetOutIndex = newAssetArray.indexOf(
                assetArray[i][poolSwap.assetOutIndex]
            );
        });
    });

    // Join Swaps into a single batchSwap
    const batchedSwaps = swaps.flat();
    return { swaps: batchedSwaps, assets: newAssetArray };
}

/*
Uses SOR to create and query a batchSwap for multiple tokens in > single tokenOut.
For example can be used to join staBal3 with DAI/USDC/USDT.
*/
async function queryBatchSwapTokensIn(
    sor: SOR,
    vaultContract: Contract,
    tokensIn: string[],
    amountsIn: BigNumberish[],
    tokenOut: string
): Promise<{ amountTokenOut: string; swaps: Swap[]; assets: string[] }> {
    const swaps: Swap[][] = [];
    const assetArray: string[][] = [];
    // get path information for each tokenIn
    for (let i = 0; i < tokensIn.length; i++) {
        const swap = await getSorSwapInfo(
            tokensIn[i],
            tokenOut,
            SwapTypes.SwapExactIn,
            amountsIn[i].toString(),
            sor
        );
        swaps.push(swap.swaps);
        assetArray.push(swap.tokenAddresses);
    }

    // Join swaps and assets together correctly
    const batchedSwaps = batchSwaps(assetArray, swaps);

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        batchedSwaps.swaps,
        batchedSwaps.assets
    );

    const amountTokenOut = deltas[batchedSwaps.assets.indexOf(tokenOut)];

    return {
        amountTokenOut,
        swaps: batchedSwaps.swaps,
        assets: batchedSwaps.assets,
    };
}

/*
queryBatchSwap for multiple tokens in > single tokenOut.
Uses existing swaps/assets information and updates swap amounts.
*/
async function queryBatchSwapTokensInUpdateAmounts(
    vaultContract: Contract,
    swaps: Swap[],
    assets: string[],
    tokens: string[],
    newAmounts: BigNumberish[],
    tokenOut: string
): Promise<{ amountTokenOut: string; swaps: Swap[]; assets: string[] }> {
    for (let i = 0; i < tokens.length; i++) {
        const tokenIndex = assets.indexOf(tokens[i]);
        swaps.forEach((poolSwap) => {
            if (
                poolSwap.assetInIndex === tokenIndex ||
                poolSwap.assetOutIndex === tokenIndex
            )
                poolSwap.amount = newAmounts[i];
        });
    }

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        swaps,
        assets
    );

    const amountTokenOut = deltas[assets.indexOf(tokenOut)];

    return {
        amountTokenOut,
        swaps,
        assets,
    };
}

/*
Uses SOR to create and query a batchSwap for a single token in > multiple tokens out.
For example can be used to exit staBal3 to DAI/USDC/USDT.
*/
async function queryBatchSwapTokensOut(
    sor: SOR,
    vaultContract: Contract,
    tokenIn: string,
    amountsIn: BigNumberish[],
    tokensOut: string[]
): Promise<{ amountTokensOut: string[]; swaps: Swap[]; assets: string[] }> {
    const swaps: Swap[][] = [];
    const assetArray: string[][] = [];
    // get path information for each tokenOut
    for (let i = 0; i < tokensOut.length; i++) {
        const swap = await getSorSwapInfo(
            tokenIn,
            tokensOut[i],
            SwapTypes.SwapExactIn,
            amountsIn[i].toString(),
            sor
        );
        swaps.push(swap.swaps);
        assetArray.push(swap.tokenAddresses);
    }

    // Join swaps and assets together correctly
    const batchedSwaps = batchSwaps(assetArray, swaps);

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        batchedSwaps.swaps,
        batchedSwaps.assets
    );

    const amountTokensOut = [];
    tokensOut.forEach((t) => {
        const amount = deltas[batchedSwaps.assets.indexOf(t)];
        if (amount) amountTokensOut.push(amount);
        else amountTokensOut.push('0');
    });

    return {
        amountTokensOut,
        swaps: batchedSwaps.swaps,
        assets: batchedSwaps.assets,
    };
}

/*
queryBatchSwap for a single token in > multiple tokens out.
Uses existing swaps/assets information and updates swap amounts.
*/
async function queryBatchSwapTokensOutUpdateAmounts(
    vaultContract: Contract,
    swaps: Swap[],
    assets: string[],
    newAmounts: BigNumberish[],
    tokensOut: string[]
): Promise<{ amountTokensOut: string[]; swaps: Swap[]; assets: string[] }> {
    for (let i = 0; i < tokensOut.length; i++) {
        const tokenIndex = assets.indexOf(tokensOut[i]);
        swaps.forEach((poolSwap) => {
            if (
                poolSwap.assetInIndex === tokenIndex ||
                poolSwap.assetOutIndex === tokenIndex
            )
                poolSwap.amount = newAmounts[i];
        });
    }

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        swaps,
        assets
    );

    const amountTokensOut = [];
    tokensOut.forEach((t) => {
        const amount = deltas[assets.indexOf(t)];
        if (amount) amountTokensOut.push(amount);
        else amountTokensOut.push('0');
    });

    return {
        amountTokensOut,
        swaps: swaps,
        assets: assets,
    };
}

// Example running a join of staBal3 pool with underlying stable tokens
async function example() {
    const [sor, vaultContract] = await setUp();

    /*
    CASE - DAI, USDC, USDT > staBal3Bpt
    This has potential to be a costly call as it needs to query subgraph and onchain.
    */
    const queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address],
        [parseFixed('1', 18), parseFixed('1', 6), parseFixed('1', 6)],
        STABAL3PHANTOM.address
    );

    console.log(queryResult.amountTokenOut.toString());

    /*
    To avoid unnecessary subgraph call we can reuse swap information from above (as paths are same) and only update amounts.
    */
    const updatedQueryResult = await queryBatchSwapTokensInUpdateAmounts(
        vaultContract,
        queryResult.swaps,
        queryResult.assets,
        [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address],
        [parseFixed('0.5', 18), parseFixed('0.5', 6), parseFixed('0.5', 6)],
        STABAL3PHANTOM.address
    );

    console.log(updatedQueryResult.amountTokenOut.toString());

    /*
    CASE - staBal3Bpt >  DAI, USDC, USDT
    Here we are splitting 0.3BPT In equally between each of DAI/USDC/USDT, i.e. 0.1 each.
    This has potential to be a costly call as it needs to query subgraph and onchain.
    */
    const queryTokensOutResult = await queryBatchSwapTokensOut(
        sor,
        vaultContract,
        STABAL3PHANTOM.address,
        [parseFixed('0.1', 18), parseFixed('0.1', 18), parseFixed('0.1', 18)],
        [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address]
    );

    console.log(queryTokensOutResult.amountTokensOut.toString());

    /*
    To avoid unnecessary subgraph call we can reuse swap information from above (as paths are same) and only update amounts.
    */
    const updatedQueryTokensOutResult =
        await queryBatchSwapTokensOutUpdateAmounts(
            vaultContract,
            queryTokensOutResult.swaps,
            queryTokensOutResult.assets,
            [
                parseFixed('0.05', 18),
                parseFixed('0.05', 18),
                parseFixed('0.05', 18),
            ],
            [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address]
        );

    console.log(updatedQueryTokensOutResult.amountTokensOut.toString());
}

// ts-node ./balancer/queryBatchSwapHelpers.ts
example();
