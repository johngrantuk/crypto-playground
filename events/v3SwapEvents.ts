// npx ts-node ./events/v3SwapEvents.ts
import { Address, createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

async function getSwapFeeEventsInChunks(
    contractAddress: Address,
    startBlockNumber: number,
    endBlockNumber: number
) {
    const publicClient = createPublicClient({
        chain: base,
        transport: http(
            'https://base-mainnet.g.alchemy.com/v2/oSZPEiBtkHoHQvKFmyQTvsMCmxnsGdmH'
        ),
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
