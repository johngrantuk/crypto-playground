import dotenv from 'dotenv';
import { parseFixed } from '@ethersproject/bignumber';
import { Wallet } from '@ethersproject/wallet';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';

import {
    BalancerSDK,
    Network,
    ConfigSdk,
    SUBGRAPH_URLS,
    AaveHelpers,
    FundManagement,
} from '@balancer-labs/sdk';

interface TestToken {
    address: string;
    decimals: number;
}

// Kovan version
export const STABAL3PHANTOM: TestToken = {
    address: '0x8fd162f338b770f7e879030830cde9173367f301',
    decimals: 18,
};

// Kovan version
export const AAVE_USDT: TestToken = {
    address: '0x13512979ade267ab5100878e2e0f485b568328a4',
    decimals: 6,
};

// Kovan version
export const AAVE_USDC: TestToken = {
    address: '0xe22da380ee6b445bb8273c81944adeb6e8450422',
    decimals: 6,
};

// Kovan version
export const AAVE_DAI: TestToken = {
    address: '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
    decimals: 18,
};

// Kovan version
export const WRAPPED_AAVE_USDT: TestToken = {
    address: '0xe8191aacfcdb32260cda25830dc6c9342142f310',
    decimals: 6,
};

// Kovan version
export const WRAPPED_AAVE_USDC: TestToken = {
    address: '0x0fbddc06a4720408a2f5eb78e62bc31ac6e2a3c4',
    decimals: 6,
};

// Kovan version
export const WRAPPED_AAVE_DAI: TestToken = {
    address: '0x4811a7bb9061a46753486e5e84b3cd3d668fb596',
    decimals: 18,
};

dotenv.config();

/*
Example showing how to exit bb-a-USDC to stables via Relayer.
ExactIn - Exact amount of tokenIn to use in swap.
User must approve relayer
Vault must have approvals for tokens
*/
async function runRelayerSwapUnwrapExactIn() {
    const config: ConfigSdk = {
        network: Network.KOVAN,
        rpcUrl: `https://kovan.infura.io/v3/${process.env.INFURA}`,
        subgraphUrl: SUBGRAPH_URLS[Network.KOVAN],
    };

    const provider = new JsonRpcProvider(config.rpcUrl);
    const key: any = process.env.TRADER_KEY;
    const relayerAddress = '0x3C255DE4a73Dd251A33dac2ab927002C964Eb2cB';
    const wallet = new Wallet(key, provider);

    const balancer = new BalancerSDK(config);

    balancer.swaps.fetchPools([], false);

    // Creates fund management info for swap part of call
    const funds: FundManagement = {
        sender: wallet.address,
        recipient: relayerAddress, // Note relayer is recipient of swaps
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    // This is using a helper function to get the up to date rates for the Aave tokens
    const daiRate = await AaveHelpers.getRate(
        '0x26575a44755e0aaa969fdda1e4291df22c5624ea',
        provider
    );
    const usdcRate = await AaveHelpers.getRate(
        '0x26743984e3357eFC59f2fd6C1aFDC310335a61c9',
        provider
    );
    const usdtRate = await AaveHelpers.getRate(
        '0xbfd9769b061e57e478690299011a028194d66e3c',
        provider
    );

    const txInfo = await balancer.relayer.swapUnwrapAaveStaticExactIn(
        [
            STABAL3PHANTOM.address,
            STABAL3PHANTOM.address,
            STABAL3PHANTOM.address,
        ],
        [
            WRAPPED_AAVE_DAI.address,
            WRAPPED_AAVE_USDC.address,
            WRAPPED_AAVE_USDT.address,
        ],
        [parseFixed('1', 16).toString(), parseFixed('1', 16).toString(), parseFixed('1', 16).toString()],
        [daiRate, usdcRate, usdtRate],
        funds,
        '50000000000000000' // Slippage 5%
    );

    console.log(txInfo.outputs.amountsOut.toString());

    // const relayerContract = new Contract(relayerAddress, balancerRelayerAbi, provider);
    // const tx = await relayerContract.connect(wallet)[txInfo.function](txInfo.params, {
    //     value: '0',
    //     // gasLimit: '200000',
    // });
    // console.log(tx);
}

/*
Example showing how to exit bb-a-USDC to stables via Relayer.
ExactOut - Exact amount of tokens out are used for swaps.
User must approve relayer
Vault must have approvals for tokens
*/
async function runRelayerSwapUnwrapExactOut() {
    const config: ConfigSdk = {
        network: Network.KOVAN,
        rpcUrl: `https://kovan.infura.io/v3/${process.env.INFURA}`,
        subgraphUrl: SUBGRAPH_URLS[Network.KOVAN],
    };

    const provider = new JsonRpcProvider(config.rpcUrl);
    const key: any = process.env.TRADER_KEY;
    const relayerAddress = '0x3C255DE4a73Dd251A33dac2ab927002C964Eb2cB';
    const wallet = new Wallet(key, provider);

    const balancer = new BalancerSDK(config);

    balancer.swaps.fetchPools([], true);

    // Creates fund management info for swap part of call
    const funds: FundManagement = {
        sender: wallet.address,
        recipient: relayerAddress, // Note relayer is recipient of swaps
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    // This is using a helper function to get the up to date rates for the Aave tokens
    const daiRate = await AaveHelpers.getRate(
        '0x26575a44755e0aaa969fdda1e4291df22c5624ea',
        provider
    );
    const usdcRate = await AaveHelpers.getRate(
        '0x26743984e3357eFC59f2fd6C1aFDC310335a61c9',
        provider
    );
    const usdtRate = await AaveHelpers.getRate(
        '0xbfd9769b061e57e478690299011a028194d66e3c',
        provider
    );

    console.log(usdcRate.toString());
    // const txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
    //     [
    //         STABAL3PHANTOM.address,
    //         STABAL3PHANTOM.address,
    //         STABAL3PHANTOM.address,
    //     ],
    //     [
    //         WRAPPED_AAVE_DAI.address,
    //         WRAPPED_AAVE_USDC.address,
    //         WRAPPED_AAVE_USDT.address,
    //     ],
    //     [parseFixed('1', 16), '1000', '1000'], // Amount of unwrapped Aave token we want to receive
    //     [daiRate, usdcRate, usdtRate],
    //     funds,
    //     '50000000000000000' // Slippage 5%
    // );
    let txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['100000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['100000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['1100000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['1000000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['10000000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );
    // 10000

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['1900000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );
    // 10000

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    txInfo = await balancer.relayer.swapUnwrapAaveStaticExactOut(
        [STABAL3PHANTOM.address],
        [WRAPPED_AAVE_USDC.address],
        ['1000000000'], // Amount of unwrapped Aave token we want to receive
        [usdcRate],
        funds,
        '10000000000000000' // Slippage 5%
    );

    console.log(`Amounts In:`);
    console.log(txInfo.outputs.amountsIn);

    // const relayerContract = new Contract(relayerAddress, balancerRelayerAbi, provider);
    // const tx = await relayerContract.connect(wallet)[txInfo.function](txInfo.params, {
    //     value: '0',
    //     gasPrice: '6000000000'
    //     // gasLimit: '200000',
    // });
    // console.log(tx);
}

// ts-node sdkTest.ts
// runRelayerSwapUnwrapExactOut();
runRelayerSwapUnwrapExactIn();
