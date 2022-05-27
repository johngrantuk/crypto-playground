/**
 * queryBatchSwap simulates a call to `batchSwap`, returning an array of Vault asset deltas. Calls to `swap` cannot be
 * simulated directly, but an equivalent `batchSwap` call can and will yield the exact same result.
 *
 * Each element in the array corresponds to the asset at the same index, and indicates the number of tokens (or ETH)
 * the Vault would take from the sender (if positive) or send to the recipient (if negative). The arguments it
 * receives are the same that an equivalent `batchSwap` call would receive.
 *
 * Unlike `batchSwap`, this function performs no checks on the sender or recipient field in the `funds` struct.
 * This makes it suitable to be called by off-chain applications via eth_call without needing to hold tokens,
 * approve them for the Vault, or even know a user's address.
 **/
require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import { AddressZero } from '@ethersproject/constants';

import { PROVIDER_URLS, Network } from '../constants/network';
import { balancerVault } from '../constants/addresses';
import { FundManagement, SwapTypes, Swap } from './types';
import { getRate } from './wrappedTokenRateProvider';

import vaultAbi from '../abi/Vault.json';

const SWAPS = {
    SINGLE: {
        swapType: SwapTypes.SwapExactIn,
        swaps: [
            {
                poolId: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1000000000000000000',
                userData: '0x',
            },
        ],
        assets: [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ],
    },
    SINGLE_STABLE: {
        swapType: SwapTypes.SwapExactIn,
        swaps: [
            {
                poolId: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1837703247',
                userData: '0x',
            },
        ],
        assets: [
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0x6b175474e89094c44da98b954eedeac495271d0f',
        ],
    },
    'DAI-STABAL3-USDC': {
        swapType: SwapTypes.SwapExactOut,
        swaps: [
            {
                poolId: '0x6a8c3239695613c0710dc971310b36f9b81e115e00000000000000000000023e',
                assetInIndex: 2,
                assetOutIndex: 3,
                amount: '123456',
                userData: '0x',
            },
            {
                poolId: '0x21ff756ca0cfcc5fff488ad67babadffee0c4149000000000000000000000240',
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: '0',
                userData: '0x',
            },
            {
                poolId: '0xcd32a460b6fecd053582e43b07ed6e2c04e1536900000000000000000000023c',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '0',
                userData: '0x',
            },
        ],
        assets: [
            '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
            '0xcd32a460b6fecd053582e43b07ed6e2c04e15369',
            '0x6a8c3239695613c0710dc971310b36f9b81e115e',
            '0x13512979ade267ab5100878e2e0f485b568328a4',
        ],
    },
    'DAI-STABAL3': {
        swapType: SwapTypes.SwapExactIn,
        swaps: [
            {
                poolId: '0xcd32a460b6fecd053582e43b07ed6e2c04e1536900000000000000000000023c',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1000000000000000000',
                userData: '0x',
            },
            {
                poolId: '0x21ff756ca0cfcc5fff488ad67babadffee0c4149000000000000000000000240',
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: '0',
                userData: '0x',
            },
        ],
        assets: [
            '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
            '0xcd32a460b6fecd053582e43b07ed6e2c04e15369',
            '0x21ff756ca0cfcc5fff488ad67babadffee0c4149',
        ],
    },
    'aUSDT-staBAL3': {
        swapType: SwapTypes.SwapExactIn,
        swaps: [
            {
                poolId: '0x6a8c3239695613c0710dc971310b36f9b81e115e00000000000000000000023e',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1000000',
                userData: '0x',
            },
            {
                poolId: '0x21ff756ca0cfcc5fff488ad67babadffee0c4149000000000000000000000240',
                assetInIndex: 1,
                assetOutIndex: 2,
                amount: '0',
                userData: '0x',
            },
        ],
        assets: [
            '0xe8191aacfcdb32260cda25830dc6c9342142f310',
            '0x6a8c3239695613c0710dc971310b36f9b81e115e',
            '0x21ff756ca0cfcc5fff488ad67babadffee0c4149',
        ],
    },
};

/*
 * queryBatchSwap simulates a call to `batchSwap`, returning an array of Vault asset deltas. Calls to `swap` cannot be
 * simulated directly, but an equivalent `batchSwap` call can and will yield the exact same result.
 *
 * Each element in the array corresponds to the asset at the same index, and indicates the number of tokens (or ETH)
 * the Vault would take from the sender (if positive) or send to the recipient (if negative). The arguments it
 * receives are the same that an equivalent `batchSwap` call would receive.
 *
 * Unlike `batchSwap`, this function performs no checks on the sender or recipient field in the `funds` struct.
 * This makes it suitable to be called by off-chain applications via eth_call without needing to hold tokens,
 * approve them for the Vault, or even know a user's address.
 */
export async function queryBatchSwap(
    vaultContract: Contract,
    swapType: SwapTypes,
    swaps: Swap[],
    assets: string[]
): Promise<string[]> {
    const funds: FundManagement = {
        sender: AddressZero,
        recipient: AddressZero,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    return await vaultContract.queryBatchSwap(swapType, swaps, assets, funds);
}

async function fullQuery() {
    const networkId = Network.MAINNET;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const vaultContract = new Contract(balancerVault, vaultAbi, provider);

    // await getRate('0x26575A44755E0aaa969FDda1E4291Df22C5624Ea'); // Rate for Kovan waDAI
    // await getRate('0x26743984e3357efc59f2fd6c1afdc310335a61c9'); // Rate for Kovan waUSDC
    // await getRate('0xbfd9769b061e57e478690299011a028194d66e3c'); // Rate for Kovan waUSDT
    const deltas = await queryBatchSwap(
        vaultContract,
        SWAPS.SINGLE.swapType,
        SWAPS.SINGLE.swaps,
        SWAPS.SINGLE.assets
    );

    console.log(deltas.toString());
    console.log(deltas[1].toString().split('-')[1]);
    SWAPS.SINGLE_STABLE.swaps[0].amount = deltas[1].toString().split('-')[1];

    const stabledeltas = await queryBatchSwap(
        vaultContract,
        SWAPS.SINGLE_STABLE.swapType,
        SWAPS.SINGLE_STABLE.swaps,
        SWAPS.SINGLE_STABLE.assets
    );

    console.log(stabledeltas.toString());
    // await getRate('0x26575A44755E0aaa969FDda1E4291Df22C5624Ea');
    // await getRate('0xbfd9769b061e57e478690299011a028194d66e3c');
}

// ts-node ./balancer/queryBatchSwap.ts
fullQuery();
