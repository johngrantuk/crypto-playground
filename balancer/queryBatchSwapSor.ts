/*
Phantom pools allow for join/exit of pool using swaps.
One possible way to find BPT out for tokens in is to queryBatchSwap for each token swap.
This uses the SOR helper queryBatchSwapTokensIn to find amount of BPT for tokens in.
*/
require('dotenv').config();
import { getAddress } from '@ethersproject/address';
import { SOR, queryBatchSwapTokensIn } from 'sor-linear';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { parseFixed } from '@ethersproject/bignumber';

import { PROVIDER_URLS, Network } from '../constants/network';
import { SUBGRAPH_URLS } from '../constants/subgraph';
import {
    balancerVault,
    AAVE_DAI,
    AAVE_USDC,
    AAVE_USDT,
    STABAL3PHANTOM,
} from '../constants/addresses';

import vaultAbi from '../abi/Vault.json';

// Setup - generic setup of provider/SOR, etc.
async function setUp(): Promise<[SOR, Contract]> {
    const networkId = Network.KOVAN;
    const subgraphUrl = SUBGRAPH_URLS[networkId];
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const vaultContract = new Contract(balancerVault, vaultAbi, provider);

    const sor = new SOR(provider, networkId, subgraphUrl);
    await sor.fetchPools([], false);
    return [sor, vaultContract];
}

// Example running a join of staBal3 pool with underlying stable tokens
async function example() {
    const [sor, vaultContract] = await setUp();

    let queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address],
        [parseFixed('100', 18), parseFixed('100', 6), parseFixed('100', 6)],
        STABAL3PHANTOM.address
    );

    console.log(`\n****** Lowercase`);
    console.log(queryResult.amountTokenOut.toString());

    queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        [
            getAddress(AAVE_DAI.address),
            getAddress(AAVE_USDC.address),
            getAddress(AAVE_USDT.address),
        ],
        [parseFixed('100', 18), parseFixed('100', 6), parseFixed('100', 6)],
        getAddress(STABAL3PHANTOM.address)
    );

    console.log(`\n****** With Address`);
    console.log(queryResult.amountTokenOut.toString());

    // Should handle revert and return 0
    queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        [AAVE_DAI.address, AAVE_USDC.address, AAVE_USDT.address],
        [parseFixed('0', 18), parseFixed('0', 6), parseFixed('0', 6)],
        STABAL3PHANTOM.address
    );

    console.log(queryResult.amountTokenOut.toString());

    queryResult = await queryBatchSwapTokensIn(
        sor,
        vaultContract,
        [AAVE_DAI.address],
        [parseFixed('100', 18)],
        STABAL3PHANTOM.address
    );

    console.log(queryResult.amountTokenOut.toString());
}

// ts-node ./balancer/queryBatchSwapSor.ts
example();
