// npx ts-node ./events/v3SwapEvents.ts
import 'dotenv/config';
import { Address, createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

const BASE_RPC_URL = process.env.BASE_RPC_URL;
if (!BASE_RPC_URL) {
    throw new Error('Missing BASE_RPC_URL in environment (.env).');
}

async function getSwapFeeEventsInChunks(
    contractAddress: Address,
    startBlockNumber: number,
    endBlockNumber: number
) {
    const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
    });

    const eventSignature = parseAbiItem(
        'event SwapFeePercentageChanged(address indexed pool, uint256 swapFeePercentage)'
    );

    // const latestBlock = await client.getBlockNumber();
    const CHUNK_SIZE = 10000n; // Adjust based on your needs
    let currentBlock = BigInt(startBlockNumber);
    let allEvents = [];

    while (currentBlock <= BigInt(endBlockNumber)) {
        const endBlock =
            currentBlock + CHUNK_SIZE > BigInt(endBlockNumber)
                ? BigInt(endBlockNumber)
                : currentBlock + CHUNK_SIZE;

        console.log(
            `Fetching events from blocks ${currentBlock} to ${endBlock}...`
        );

        const events = await publicClient.getContractEvents({
            address: contractAddress,
            abi: [eventSignature],
            fromBlock: currentBlock,
            toBlock: endBlock,
        });

        allEvents = [...allEvents, ...events];
        currentBlock = endBlock + 1n;
    }

    return allEvents.map((event) => ({
        blockNumber: Number(event.blockNumber),
        transactionHash: event.transactionHash,
        pool: event.args.pool,
        swapFeePercentage: event.args.swapFeePercentage,
    }));
}

async function main() {
    const events = await getSwapFeeEventsInChunks(
        '0xbA1333333333a1BA1108E8412f11850A5C319bA9' as Address,
        28449841,
        28612332
    );
    console.log(events);
}

main();
