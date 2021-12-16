// Example showing SOR with Vault batchSwap and Subgraph pool data, run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts
require('dotenv').config();
import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Contract } from '@ethersproject/contracts';
import { AddressZero, Zero } from '@ethersproject/constants';
import { SOR, SwapInfo, SwapTypes } from 'sor-linear';
import vaultArtifact from '../../abi/Vault.json';
import { fetchTrade, SorApiRequest } from './fetchTrade';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
    ARBITRUM = 42161,
}

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.KOVAN]: `https://kovan.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://rpc-mainnet.matic.network`,
    [Network.ARBITRUM]: `https://arb1.arbitrum.io/rpc`,
};

export const SUBGRAPH_URLS = {
    [Network.MAINNET]:
        'https://api.thegraph.com/subgraphs/name/mendesfabio/balancer-v2',
    [Network.GOERLI]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
    [Network.KOVAN]:
        'https://api.thegraph.com/subgraphs/name/mendesfabio/balancer-kovan-v2',
    [Network.POLYGON]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
    [Network.ARBITRUM]: `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2`,
};

export const ADDRESSES = {
    [Network.MAINNET]: {
        BatchRelayer: {
            address: '0xdcdbf71A870cc60C6F9B621E28a7D3Ffd6Dd4965',
        },
        ETH: {
            address: AddressZero,
            decimals: 18,
            symbol: 'ETH',
        },
        BAL: {
            address: '0xba100000625a3754423978a60c9317c58a424e3d',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
            decimals: 18,
            symbol: 'STETH',
        },
        wSTETH: {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            decimals: 18,
            symbol: 'wSTETH',
        },
    },
    [Network.KOVAN]: {
        // Visit https://balancer-faucet.on.fleek.co/#/faucet for test tokens
        BatchRelayer: {
            address: '0x41B953164995c11C81DA73D212ED8Af25741b7Ac',
        },
        ETH: {
            address: AddressZero,
            decimals: 18,
            symbol: 'ETH',
        },
        BAL: {
            address: '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x1C8E3Bcb3378a443CC591f154c5CE0EBb4dA9648',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x04DF6e4121c27713ED22341E7c7Df330F56f289B',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0x4803bb90d18a1cb7a2187344fe4feb0e07878d05',
            decimals: 18,
            symbol: 'STETH',
        },
        wSTETH: {
            address: '0xa387b91e393cfb9356a460370842bc8dbb2f29af',
            decimals: 18,
            symbol: 'wSTETH',
        },
        USDT_from_AAVE: {
            address: '0x13512979ade267ab5100878e2e0f485b568328a4',
            decimals: 6,
            symbol: 'USDT_from_AAVE',
        },
        aUSDT: {
            address: '0xe8191aacfcdb32260cda25830dc6c9342142f310',
            decimals: 6,
            symbol: 'aUSDT',
        },
        bUSDT: {
            address: '0xe667d48618e71c2a02e4a1b66ed9def1426938b6',
            decimals: 18,
            symbol: 'bUSDT',
        },
        USDC_from_AAVE: {
            address: '0xe22da380ee6b445bb8273c81944adeb6e8450422',
            decimals: 6,
            symbol: 'USDC_from_AAVE',
        },
        aUSDC: {
            address: '0x0fbddc06a4720408a2f5eb78e62bc31ac6e2a3c4',
            decimals: 6,
            symbol: 'aUSDC',
        },
        DAI_from_AAVE: {
            address: '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
            decimals: 18,
            symbol: 'DAI_from_AAVE',
        },
        bDAI: {
            address: '0xfcccb77a946b6a3bd59d149f083b5bfbb8004d6d',
            decimals: 18,
            symbol: 'bDAI',
        },
        STABAL3: {
            address: '0x8fd162f338b770f7e879030830cde9173367f301',
            decimals: 18,
            symbol: 'STABAL3',
        },
    },
    [Network.POLYGON]: {
        MATIC: {
            address: AddressZero,
            decimals: 18,
            symbol: 'MATIC',
        },
        BAL: {
            address: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
            decimals: 18,
            symbol: 'DAI',
        },
    },
    [Network.ARBITRUM]: {
        WETH: {
            address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            decimals: 18,
            symbol: 'WETH',
        },
        BAL: {
            address: '0x040d1edc9569d4bab2d15287dc5a4f10f56a56b8',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
            decimals: 6,
            symbol: 'USDC',
        },
        STETH: {
            address: 'N/A',
            decimals: 18,
            symbol: 'STETH',
        },
    },
};

// This is the same across networks
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

// gasPrice is used by SOR as a factor to determine how many pools to swap against.
// i.e. higher cost means more costly to trade against lots of different pools.
const gasPrice = parseFixed('50', 9); //  BigNumber.from('40000000000');

async function setUpSor(
    provider: JsonRpcProvider,
    networkId: number,
    poolsSource: string,
    queryOnChain: boolean
): Promise<SOR> {
    console.log(poolsSource);
    console.log(networkId);
    const sor = new SOR(provider, networkId, poolsSource);
    await sor.fetchPools([], queryOnChain);
    return sor;
}

async function getSwap(
    sor: SOR,
    tokenIn: { symbol: string; address: string; decimals: number },
    tokenOut: { symbol: string; address: string; decimals: number },
    swapType: SwapTypes,
    swapAmount: BigNumberish
): Promise<{
    swapInfo: SwapInfo;
    cost: BigNumber;
}> {
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
    const outputToken =
        swapType === SwapTypes.SwapExactOut ? tokenIn : tokenOut;
    const cost = await sor.getCostOfSwapInToken(
        outputToken.address,
        outputToken.decimals,
        gasPrice,
        BigNumber.from('35000')
    );
    // await sor.swapCostCalculator.setNativeAssetPriceInToken(
    //     tokenOut.address,
    //     '0'
    // );
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools }
    );
    return { swapInfo, cost };
}

async function queryTrade(
    provider: JsonRpcProvider,
    swapInfo: SwapInfo,
    swapType: SwapTypes
): Promise<string[]> {
    if (!swapInfo.returnAmount.gt(0)) {
        console.log(`Return Amount is 0. No swaps to exectute.`);
        return;
    }

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);

    type FundManagement = {
        sender: string;
        recipient: string;
        fromInternalBalance: boolean;
        toInternalBalance: boolean;
    };

    const funds: FundManagement = {
        sender: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        recipient: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    const limits: string[] = getLimits(
        swapInfo.tokenIn,
        swapInfo.tokenOut,
        swapType,
        swapInfo.swapAmount,
        swapInfo.returnAmount,
        swapInfo.tokenAddresses
    );

    const overRides = {};
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === AddressZero) {
        overRides['value'] = swapInfo.swapAmount.toString();
    }

    const deltas = await vaultContract.queryBatchSwap(
        swapType, // SwapType 0=SwapExactIn, 1=SwapExactOut
        swapInfo.swaps,
        swapInfo.tokenAddresses,
        funds
    );
    return deltas;
}

function getLimits(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    returnAmount: BigNumber,
    tokenAddresses: string[]
): string[] {
    // Limits:
    // +ve means max to send
    // -ve mean min to receive
    // For a multihop the intermediate tokens should be 0
    // This is where slippage tolerance would be added
    const limits: string[] = [];
    const amountIn =
        swapType === SwapTypes.SwapExactIn ? swapAmount : returnAmount;
    const amountOut =
        swapType === SwapTypes.SwapExactIn ? returnAmount : swapAmount;

    tokenAddresses.forEach((token, i) => {
        if (token.toLowerCase() === tokenIn.toLowerCase())
            limits[i] = amountIn.toString();
        else if (token.toLowerCase() === tokenOut.toLowerCase()) {
            limits[i] = amountOut
                .mul('990000000000000000') // 0.99
                .div('1000000000000000000')
                .mul(-1)
                .toString()
                .split('.')[0];
        } else {
            limits[i] = '0';
        }
    });

    return limits;
}

function displayResult(
    tokenIn: any,
    tokenOut: any,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    swapInfo: SwapInfo,
    cost: BigNumberish,
    deltas: string[],
    gnosis: any
) {
    const tokenInIndex = swapInfo.tokenAddresses.indexOf(tokenIn.address);
    const tokenOutIndex = swapInfo.tokenAddresses.indexOf(tokenOut.address);

    const amtInQuery = BigNumber.from(deltas[tokenInIndex]).abs();
    const amtOutQuery = BigNumber.from(deltas[tokenOutIndex]).abs();

    const amtInSor =
        swapType === SwapTypes.SwapExactIn ? swapAmount : swapInfo.returnAmount;
    const amtOutSor =
        swapType === SwapTypes.SwapExactIn ? swapInfo.returnAmount : swapAmount;

    const swapTypeStr =
        swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';

    if (!amtInSor.eq(amtInQuery) || !amtOutSor.eq(amtOutQuery)) {
        const amtInScaled = formatFixed(amtInSor, tokenIn.decimals);
        const amtOutScaled = formatFixed(amtOutSor, tokenOut.decimals);

        const returnDecimals =
            swapType === SwapTypes.SwapExactIn
                ? tokenOut.decimals
                : tokenIn.decimals;

        const returnWithFeesScaled = formatFixed(
            swapInfo.returnAmountConsideringFees,
            returnDecimals
        );

        const costToSwapScaled = formatFixed(cost, returnDecimals);
        console.log('\n!!!!!!! SOR and Query Mis-Match');
        console.log(swapTypeStr);
        console.log(
            `Token In: ${tokenIn.symbol}, Amt: ${amtInScaled.toString()}`
        );
        console.log(
            `Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`
        );
        console.log(amtInSor.toString());
        console.log(amtInQuery.toString());
        console.log(amtOutSor.toString());
        console.log(amtOutQuery.toString());
        console.log(`Cost to swap: ${costToSwapScaled.toString()}`);
        console.log(
            `Return Considering Fees: ${returnWithFeesScaled.toString()}`
        );
        console.log(`Swaps:`);
        console.log(swapInfo.swaps);
        console.log(swapInfo.tokenAddresses);
        console.log(deltas.toString());
    } else {
        console.log('\nSOR and Query Match');
        console.log(
            `${swapTypeStr} ${tokenIn.symbol}>${
                tokenOut.symbol
            } ${amtInSor.toString()} ${amtOutSor.toString()}`
        );
        console.log(swapInfo.returnAmount.toString());
        console.log(swapInfo.returnAmountConsideringFees.toString());
    }

    console.log(`SOR Results:`);
    console.log(swapInfo.returnAmount.toString());
    console.log(swapInfo.returnAmountConsideringFees.toString());
    console.log('GNOSIS RESULTS:');
    console.log(BigNumber.from(gnosis.returnAmount.hex).toString());
    console.log(
        BigNumber.from(gnosis.returnAmountConsideringFees.hex).toString()
    );
    console.table([
        ['returnAmout', 'WithFees'],
        [
            swapInfo.returnAmount.toString(),
            swapInfo.returnAmountConsideringFees.toString(),
        ],
        [
            BigNumber.from(gnosis.returnAmount.hex).toString(),
            BigNumber.from(gnosis.returnAmountConsideringFees.hex).toString(),
        ],
    ]);
    console.log(gnosis.swaps);
    console.log(swapInfo.swaps);
}

async function testSwaps() {
    const networkId = Network.MAINNET;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const poolsSource = SUBGRAPH_URLS[networkId];
    const queryOnChain = true;
    // curl https://2ls8yjzbzl.execute-api.ap-southeast-2.amazonaws.com/prod/tokens/1
    const gnosisEndPoint =
        'https://to8cp89xdl.execute-api.eu-west-2.amazonaws.com/prod/sor/1';

    const swaps = [
        {
            tokenIn: ADDRESSES[networkId].USDC,
            tokenOut: ADDRESSES[networkId].BAL,
            swapType: SwapTypes.SwapExactIn,
            amt: parseFixed('14', 6),
        },
    ];

    const sor = await setUpSor(provider, networkId, poolsSource, queryOnChain);

    const results = [];
    for (let i = 0; i < swaps.length; i++) {
        const { tokenIn, tokenOut, swapType, amt } = swaps[i];
        const { swapInfo, cost } = await getSwap(
            sor,
            tokenIn,
            tokenOut,
            swapType,
            amt
        );
        const deltas = await queryTrade(provider, swapInfo, swapType);

        // const buyToken = swapType === SwapTypes.SwapExactIn ? tokenOut.address : tokenIn.address;
        // const sellToken = swapType === SwapTypes.SwapExactIn ? tokenIn.address : tokenOut.address;
        const orderKind = swapType === SwapTypes.SwapExactIn ? 'sell' : 'buy';

        const gnosis = await fetchTrade(gnosisEndPoint, {
            buyToken: tokenOut.address,
            sellToken: tokenIn.address,
            orderKind,
            amount: amt.toString(),
            gasPrice: gasPrice.toString(),
        });

        results.push({
            swapInfo,
            cost,
            deltas,
            gnosis,
        });
    }
    for (let i = 0; i < swaps.length; i++) {
        const { tokenIn, tokenOut, swapType, amt } = swaps[i];
        const { swapInfo, cost, deltas, gnosis } = results[i];
        displayResult(
            tokenIn,
            tokenOut,
            swapType,
            amt,
            swapInfo,
            cost,
            deltas,
            gnosis
        );
    }
}

// ts-node ./balancer/gnosis/sorCompare.ts
testSwaps();
