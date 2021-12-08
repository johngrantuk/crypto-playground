/*
WIP
Simulates a batchSwap, a series of swaps with one or multiple Pools.
(See: https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/vault/contracts/interfaces/IVault.sol#L539)
SwapExactOut case needs to be handled separately.
*/
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { PoolDictionary, SOR, parseToPoolsDict } from 'sor-linear';
import { bnum, scale, BigNumber as OldBigNumber } from '../utils/bignumber';

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
import { queryBatchSwapTokensIn } from './queryBatchSwapHelpers';

import vaultAbi from '../abi/Vault.json';

// Setup - generic setup of provider/SOR, etc.
async function setUp(): Promise<[SOR, Contract]> {
    const networkId = Network.KOVAN;
    const subgraphUrl = SUBGRAPH_URLS[networkId];
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const vaultContract = new Contract(balancerVault, vaultAbi, provider);

    const sor = new SOR(provider, networkId, subgraphUrl);

    // Will get pool info from SG with onchain balances
    await sor.fetchPools([], true);
    return [sor, vaultContract];
}

/*
Replicates batchSwap call using pools state.
Returns deltas of assets similar to Contract version.
*/
function queryBatchSwapTs(
    pools: PoolDictionary,
    swaps: Swap[],
    assets: string[]
): BigNumber[] {
    const deltas: BigNumber[] = Array(assets.length).fill(Zero);
    let lastAmount = bnum('0');
    // For each swap calculate swap result, update pool balances and deltas
    swaps.forEach((swap) => {
        const swapPool = pools[swap.poolId];
        if (!swapPool) throw `Pool Doesn't Exist: ${swap.poolId}`;

        // Formats data for tokenIn/Out
        const poolPairData = swapPool.parsePoolPairData(
            assets[swap.assetInIndex],
            assets[swap.assetOutIndex]
        );

        let swapAmountHuman: OldBigNumber;
        // TS maths uses human scale numbers
        // An amount of 0 means this is a multihop that uses previous swaps return amount
        if (swap.amount === '0') {
            swapAmountHuman = scale(lastAmount, -poolPairData.decimalsIn);
        } else {
            swapAmountHuman = scale(
                bnum(swap.amount.toString()),
                -poolPairData.decimalsIn
            );
        }

        const amountOutHuman = swapPool._exactTokenInForTokenOut(
            poolPairData,
            swapAmountHuman,
            true
        );

        const amountOutEvm = scale(amountOutHuman, poolPairData.decimalsOut);
        lastAmount = amountOutEvm;

        // Update pool token balances
        swapPool.updateTokenBalanceForPool(
            assets[swap.assetInIndex],
            poolPairData.balanceIn.add(
                scale(swapAmountHuman, poolPairData.decimalsIn).toString()
            )
        );
        swapPool.updateTokenBalanceForPool(
            assets[swap.assetOutIndex],
            poolPairData.balanceOut.sub(amountOutEvm.toString())
        );

        deltas[swap.assetInIndex] = deltas[swap.assetInIndex].add(swap.amount);
        deltas[swap.assetOutIndex] = deltas[swap.assetOutIndex].add(
            BigNumber.from(amountOutEvm.toString())
        );
    });

    return deltas;
}

async function example() {
    // const tokensIn = [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address];
    const tokensIn = [AAVE_USDC.address];
    const tokenOut = STABAL3PHANTOM.address;
    // const amounts = [
    //     parseFixed('1', 18),
    //     parseFixed('1', 6),
    //     parseFixed('1', 6),
    // ];
    const amounts = [parseFixed('1', 6)];
    const [sor, vaultContract] = await setUp();

    // Reference value from onChain call.
    const queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        tokensIn,
        amounts,
        tokenOut
    );

    // Get pool state
    const pools = sor.getPools();
    const poolsDict = parseToPoolsDict(pools, 0);

    // TS Calculation
    const queryTsResult = queryBatchSwapTs(
        poolsDict,
        queryResult.swaps,
        queryResult.assets
    );

    console.log(tokenOut);
    console.log(queryResult.assets);
    console.log(queryResult.amountTokenOut.toString());
    console.log(queryTsResult.toString());
}

// ts-node ./balancer/queryBatchSwapTs.ts
example();
