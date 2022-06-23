// Example showing how to use SDK to find/make swaps: $ TS_NODE_PROJECT='tsconfig.json' ts-node ./balancer/sdk-swapModule.ts
import dotenv from 'dotenv';
dotenv.config();
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { SwapTypes, BalancerSDK, Network } from '@balancer-labs/sdk';
import vaultArtifact from '../abi/Vault.json';

import { ADDRESSES, balancerVault } from '../constants/addresses';
import { PROVIDER_URLS } from '../constants/network';

export async function simpleSwap() {
    const network = Network.MAINNET;
    const rpcUrl = PROVIDER_URLS[network];
    const tokenIn = ADDRESSES[network].WETH;
    const tokenOut = ADDRESSES[network].DAI;
    const swapType = SwapTypes.SwapExactIn;
    const amount = parseFixed('1', 18);
    const provider = new JsonRpcProvider(rpcUrl, network);

    const balancer = new BalancerSDK({
        network,
        rpcUrl,
    });

    await balancer.swaps.fetchPools();

    const swapInfo = await balancer.swaps.findRouteGivenIn({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amount,
        gasPrice: parseFixed('1', 9),
        maxPools: 4,
    });

    const key: any = process.env.TRADER_KEY;
    const wallet = new Wallet(key, provider);
    const deadline = BigNumber.from(`${Math.ceil(Date.now() / 1000) + 60}`); // 60 seconds from now
    const maxSlippage = 50; // 50 bsp = 0.5%

    const transactionAttributes = balancer.swaps.buildSwap({
        userAddress: wallet.address,
        swapInfo,
        kind: 0,
        deadline,
        maxSlippage,
    });

    // Extract parameters required for sendTransaction
    const { to, data, value, attributes } = transactionAttributes;

    console.log(attributes);

    if (to.toLowerCase() === balancerVault.toLowerCase()) {
        console.log('VAULT SWAP');
        const vaultContract = new Contract(
            balancerVault,
            vaultArtifact,
            provider
        );
        const deltas = await vaultContract.queryBatchSwap(
            swapType, // SwapType 0=SwapExactIn, 1=SwapExactOut
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            attributes.funds
        );
        console.log(swapInfo.swapAmount.toString());
        console.log(swapInfo.returnAmount.toString());
        console.log(deltas.toString());
    } else {
        console.log('RELAYER SWAP');
        // TO ADD, see makeRelayerTrade in sdk-sorSwap
    }
}

// $ TS_NODE_PROJECT='tsconfig.json' ts-node ./balancer/sdk-swapModule.ts
simpleSwap();
