import { config } from 'dotenv';
config();
import {
    ChainId,
    Slippage,
    Swap,
    SwapBuildOutputExactIn,
    SwapKind,
} from '@balancer/sdk';
import {
    Address,
    createPublicClient,
    createWalletClient,
    Hex,
    http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// bun balancer/v3/swap.ts
async function run() {
    console.log('Running swap...');
    const rpcUrl = 'http://localhost:8545';
    const chainId = ChainId.BASE;
    const swapKind = SwapKind.GivenIn;
    const slippage = Slippage.fromPercentage('0.1');
    const deadline = 999999999999999999n;
    const path = {
        protocolVersion: 3 as const,
        tokens: [
            {
                address:
                    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address,
                decimals: 6,
            },
            {
                address:
                    '0x4200000000000000000000000000000000000006' as Address,
                decimals: 18,
            },
        ],
        pools: ['0x7b4c560f33a71a9f7a500af3c4c65b46fbbafdb7' as Address],
        inputAmountRaw: 1000000n,
        outputAmountRaw: 100000000000000000n,
    };

    const swap = new Swap({
        chainId,
        paths: [path],
        swapKind,
    });

    const queryOutput = await swap.query(rpcUrl);

    console.log(queryOutput);

    const call = swap.buildCall({
        slippage,
        deadline,
        queryOutput,
        wethIsEth: true,
    }) as SwapBuildOutputExactIn;

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);

    const walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('http://localhost:8545'),
    });

    const publicClient = createPublicClient({
        chain: base,
        transport: http('http://localhost:8545'),
    });

    const hash = await walletClient.sendTransaction({
        data: call.callData,
        to: call.to,
        value: call.value,
    } as any);

    const transactionReceipt = await publicClient.waitForTransactionReceipt({
        hash,
    });

    console.log(transactionReceipt);

    console.log('FINSIHED SWAP');
}

run();
