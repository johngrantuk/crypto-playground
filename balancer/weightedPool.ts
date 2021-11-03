require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { getProvider, getWallet } from '../constants/network';
import { MaxUint256 } from '@ethersproject/constants';
import { defaultAbiCoder } from '@ethersproject/abi';

import { WeightedPoolInfo } from './types';
import { tokensApprove } from '../helpers/helpers';
import { balancerVault } from '../constants/addresses';

import weightedPoolFactoryAbi from '../abi/WeightedPoolFactory.json';
import vaultAbi from '../abi/Vault.json';

async function createPool(
    weightedPoolFactoryAddr: string,
    poolInfo: WeightedPoolInfo,
    provider = getProvider(),
    wallet = getWallet(provider)
): Promise<string> {
    const poolFactory = new Contract(
        weightedPoolFactoryAddr,
        weightedPoolFactoryAbi,
        provider
    );
    poolFactory.connect(wallet);
    console.log('Creating pool...');
    const address = await poolFactory.callStatic.create(
        poolInfo.name,
        poolInfo.symbol,
        poolInfo.tokens,
        poolInfo.weights,
        poolInfo.swapFeePercentage,
        poolInfo.owner
    );

    console.log(`Will be created at address: ${address}`);
    const tx = await poolFactory
        .connect(wallet)
        .create(
            poolInfo.name,
            poolInfo.symbol,
            poolInfo.tokens,
            poolInfo.weights,
            poolInfo.swapFeePercentage,
            poolInfo.owner
        );
    console.log(tx);
    await tx.wait();
    console.log('Done');
    return address;
}

export enum JoinTypes {
    JOIN_WEIGHTED_POOL_INIT_TAG,
    JOIN_WEIGHTED_POOL_EXACT_TOKENS_IN_FOR_BPT_OUT_TAG,
    JOIN_WEIGHTED_POOL_TOKEN_IN_FOR_EXACT_BPT_OUT_TAG,
}

type JoinWeightedPoolData = {
    kind: JoinTypes;
    amountsIn?: string[];
    minimumBPT?: string[];
    bptAmountOut?: string[];
    enterTokenIndex?: number;
};

export function encodeJoinWeightedPool(joinData: JoinWeightedPoolData): string {
    if (joinData.kind === JoinTypes.JOIN_WEIGHTED_POOL_INIT_TAG) {
        return defaultAbiCoder.encode(
            ['uint256', 'uint256[]'],
            [JoinTypes.JOIN_WEIGHTED_POOL_INIT_TAG, joinData.amountsIn]
        );
    } else if (
        joinData.kind ===
        JoinTypes.JOIN_WEIGHTED_POOL_EXACT_TOKENS_IN_FOR_BPT_OUT_TAG
    ) {
        return defaultAbiCoder.encode(
            ['uint256', 'uint256[]', 'uint256'],
            [
                JoinTypes.JOIN_WEIGHTED_POOL_EXACT_TOKENS_IN_FOR_BPT_OUT_TAG,
                joinData.amountsIn,
                joinData.minimumBPT,
            ]
        );
    } else {
        return defaultAbiCoder.encode(
            ['uint256', 'uint256', 'uint256'],
            [
                JoinTypes.JOIN_WEIGHTED_POOL_TOKEN_IN_FOR_EXACT_BPT_OUT_TAG,
                joinData.bptAmountOut,
                joinData.enterTokenIndex,
            ]
        );
    }
}

async function joinPool(
    joinData: JoinWeightedPoolData,
    poolId: string,
    assets: string[],
    maxAmountsIn: string[],
    provider = getProvider(),
    wallet = getWallet(provider)
) {
    const encodedData = encodeJoinWeightedPool(joinData);
    const vaultContract = new Contract(balancerVault, vaultAbi, provider);
    vaultContract.connect(wallet);

    const tx = await vaultContract
        .connect(wallet)
        .joinPool(poolId, wallet.address, wallet.address, {
            assets,
            maxAmountsIn,
            fromInternalBalance: false,
            userData: encodedData,
        });

    console.log(tx);
}

async function createAndInitialisePool() {
    const provider = getProvider();
    const wallet = getWallet(provider);
    const weightedPoolFactoryAddr =
        '0x8e9aa87e45e92bad84d5f8dd1bff34fb92637de9';
    const assets = [
        '0x21ff756ca0cfcc5fff488ad67babadffee0c4149',
        '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
    ];
    const poolInfo = {
        name: 'WETH-STABAL3',
        symbol: 'WETH-STABAL3',
        tokens: assets,
        weights: ['500000000000000000', '500000000000000000'],
        swapFeePercentage: '1000000000000000',
        owner: wallet.address,
    };
    const address = await createPool(
        weightedPoolFactoryAddr,
        poolInfo,
        provider,
        wallet
    );
    await tokensApprove(
        poolInfo.tokens,
        balancerVault,
        MaxUint256.toString(),
        provider,
        wallet
    );

    // Need to get poolId before the below can be called
    // To Do: calculate poolId from address
    // const poolId = '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d00020000000000000000033c';
    // const maxAmountsIn = ['450000000000000000000', '100000000000000000'];
    // const joinData: JoinWeightedPoolData = {
    //     kind: JoinTypes.JOIN_WEIGHTED_POOL_INIT_TAG,
    //     amountsIn: maxAmountsIn,
    // };
    // await joinPool(
    //     joinData,
    //     poolId,
    //     assets,
    //     maxAmountsIn,
    //     provider,
    //     wallet
    // );
}

// ts-node ./balancer/weightedPool.ts
createAndInitialisePool();
