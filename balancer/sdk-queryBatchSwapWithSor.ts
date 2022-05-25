// Example showing SOR with Vault batchSwap and Subgraph pool data, run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts

import dotenv from 'dotenv';
dotenv.config();
import { parseFixed } from '@ethersproject/bignumber';
import { BalancerSDK, Network } from '@balancer-labs/sdk';
import { ADDRESSES } from '../constants/addresses';
import { PROVIDER_URLS } from '../constants/network';

async function queryBatchSwapWithSor(): Promise<void> {
    const networkId = Network.MAINNET;

    const balancer = new BalancerSDK({
        network: networkId,
        rpcUrl: PROVIDER_URLS[networkId],
    });
    await balancer.swaps.fetchPools();

    const result = await balancer.swaps.queryBatchSwapWithSor({
        tokensIn: [ADDRESSES[networkId].bbausd.address],
        tokensOut: [ADDRESSES[networkId].USDC.address],
        swapType: 1,
        amounts: [parseFixed('5', 6).toString()],
        fetchPools: {
            fetchPools: false,
            fetchOnChain: false,
        },
    });

    console.log(result);

    return;
}

// $ TS_NODE_PROJECT='tsconfig.json' ts-node ./balancer/sdk-queryBatchSwapWithSor.ts
queryBatchSwapWithSor();
