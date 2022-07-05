// Example showing SOR with Vault batchSwap and Subgraph pool data, run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./balancer/sdk-sorSwap.ts
import dotenv from 'dotenv';
dotenv.config();

import { ADDRESSES } from '../constants/addresses';
import { PROVIDER_URLS } from '../constants/network';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import {
    SwapInfo,
    SwapTypes,
    BalancerSDK,
    Network,
    SOR,
} from '@balancer-labs/sdk';
import { buildTx, printOutput } from './utils';

import vaultArtifact from '../abi/Vault.json';

// This is the same across networks
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

// Setup SOR with data services
function setUp(network: Network, rpcUrl: string): SOR {
    const balancer = new BalancerSDK({
        network,
        rpcUrl,
    });

    return balancer.sor;
}

export async function swap(): Promise<void> {
    const networkId = Network.MAINNET;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    const gasPrice = BigNumber.from('40000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;
    const tokenIn = ADDRESSES[networkId].auraBal;
    const tokenOut = ADDRESSES[networkId].balBpt;
    const swapType: SwapTypes = SwapTypes.SwapExactIn;
    const swapAmount = parseFixed('3', 18);

    const sor = setUp(networkId, PROVIDER_URLS[networkId]);

    // Get pools info using Subgraph/onchain calls
    await sor.fetchPools();

    // Find swapInfo for best trade for given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools }
    );

    // Simulate the swap transaction
    if (swapInfo.returnAmount.gt(0)) {
        const key: any = process.env.TRADER_KEY;
        const wallet = new Wallet(key, provider);
        // await handleAllowances(wallet, tokenIn: string, amount: BigNumber)
        const tx = buildTx(wallet, swapInfo, swapType);

        await printOutput(
            swapInfo,
            sor,
            tokenIn,
            tokenOut,
            swapType,
            swapAmount,
            gasPrice,
            tx.limits
        );

        if (![tokenIn, tokenOut].includes(ADDRESSES[networkId].STETH)) {
            console.log('VAULT SWAP');
            const vaultContract = new Contract(
                vaultAddr,
                vaultArtifact,
                provider
            );
            // Simulates a call to `batchSwap`, returning an array of Vault asset deltas.
            // Each element in the array corresponds to the asset at the same index, and indicates the number of tokens(or ETH)
            // the Vault would take from the sender(if positive) or send to the recipient(if negative).
            const deltas = await vaultContract.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                tx.funds
            );
            console.log(deltas.toString());
            // To actually make the trade:
            // vaultContract.connect(wallet);
            // const tx = await vaultContract
            //     .connect(wallet)
            //     .batchSwap(
            //         swapType,
            //         swapInfo.swaps,
            //         swapInfo.tokenAddresses,
            //         tx.funds,
            //         tx.limits,
            //         tx.deadline,
            //         tx.overRides
            //     );

            // console.log(`tx: ${tx}`);
        } else {
            console.log('RELAYER SWAP - Execute via batchRelayer.');
        }
    }
}

// $ TS_NODE_PROJECT='tsconfig.json' ts-node ./balancer/sdk-sorSwap2.ts
swap();
