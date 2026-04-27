// npx ts-node balancer/api/fetchReclammEarliestSwaps.ts
import 'dotenv/config';
import fetch from 'isomorphic-fetch';
import { providers } from 'ethers';

const API_ENDPOINT = 'https://api-v3.balancer.fi/';
const PAGE_SIZE = 100;
const MAINNET_RPC_URL =
    process.env.ETHEREUM_RPC_URL ||
    process.env.MAINNET_RPC_URL ||
    (process.env.INFURA
        ? `https://mainnet.infura.io/v3/${process.env.INFURA}`
        : 'https://eth.llamarpc.com');

interface GqlError {
    message: string;
}

interface GraphQLResponse<T> {
    data?: T;
    errors?: GqlError[];
}

interface PoolSummary {
    address: string;
    createTime: number;
}

interface PoolGetPoolsResponse {
    poolGetPools?: Array<{
        address: string;
        createTime: number | string;
    }>;
}

interface PoolEventBase {
    type?: string;
}

interface PoolSwapEvent extends PoolEventBase {
    blockNumber: number | string;
    tx: string;
}

interface PoolEventsResponse {
    poolEvents?: PoolEventBase[];
}

interface PoolWithEarliestSwap {
    address: string;
    createTime: number;
    createdBlock: number;
    earliestSwapBlock: number;
    earliestSwapTx: string;
    blockDelta: number;
}

const POOLS_QUERY = `
  query ReclammPools($first: Int!, $skip: Int!) {
    poolGetPools(
      where: { chainIn: MAINNET, poolTypeIn: RECLAMM }
      first: $first
      skip: $skip
    ) {
      address
      createTime
    }
  }
`;

const POOL_EVENTS_QUERY_BY_POOL_ID = `
  query PoolEventsByPoolId($poolAddress: String!, $first: Int!, $skip: Int!) {
    poolEvents(
      where: {
        chainIn: MAINNET
        poolIdIn: [$poolAddress]
        typeIn: [SWAP]
      }
      first: $first
      skip: $skip
    ) {
      type
      ... on GqlPoolSwapEventV3 {
        blockNumber
        tx
      }
    }
  }
`;

const POOL_EVENTS_QUERY_BY_ADDRESS = `
  query PoolEventsByAddress($poolAddress: String!, $first: Int!, $skip: Int!) {
    poolEvents(
      where: {
        chainIn: MAINNET
        poolIdIn: [$poolAddress]
        typeIn: [SWAP]
      }
      first: $first
      skip: $skip
    ) {
      type
      ... on GqlPoolSwapEventV3 {
        blockNumber
        tx
      }
    }
  }
`;

async function graphQlRequest<T>(
    query: string,
    variables?: Record<string, unknown>
): Promise<T> {
    const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(
            `API request failed with status: ${response.status} body: ${body}`
        );
    }

    const result: GraphQLResponse<T> = await response.json();
    if (result.errors && result.errors.length > 0) {
        throw new Error(
            `GraphQL errors: ${result.errors.map((e) => e.message).join('; ')}`
        );
    }
    if (!result.data) {
        throw new Error('Invalid GraphQL response: missing data');
    }

    return result.data;
}

function toNumber(value: string | number, label: string): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${label}: ${String(value)}`);
    }
    return parsed;
}

async function fetchAllReclammPools(): Promise<PoolSummary[]> {
    const pools: PoolSummary[] = [];
    let skip = 0;

    while (true) {
        const data = await graphQlRequest<PoolGetPoolsResponse>(POOLS_QUERY, {
            first: PAGE_SIZE,
            skip,
        });
        const page = data.poolGetPools || [];
        for (const pool of page) {
            pools.push({
                address: pool.address,
                createTime: toNumber(pool.createTime, 'createTime'),
            });
        }
        if (page.length < PAGE_SIZE) {
            break;
        }
        skip += PAGE_SIZE;
    }

    return pools;
}

function looksLikeFilterFieldError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('poolidin') ||
        lower.includes('addressin') ||
        lower.includes('unknown argument') ||
        lower.includes('unknown field')
    );
}

async function fetchEarliestSwapBlockAndTx(
    poolAddress: string
): Promise<{ blockNumber: number; tx: string } | null> {
    let skip = 0;
    let best: { blockNumber: number; tx: string } | null = null;
    let query = POOL_EVENTS_QUERY_BY_POOL_ID;
    let switchedToAddressQuery = false;

    while (true) {
        let data: PoolEventsResponse;
        try {
            data = await graphQlRequest<PoolEventsResponse>(query, {
                poolAddress: poolAddress.toLowerCase(),
                first: PAGE_SIZE,
                skip,
            });
        } catch (error) {
            if (
                !switchedToAddressQuery &&
                error instanceof Error &&
                looksLikeFilterFieldError(error.message)
            ) {
                query = POOL_EVENTS_QUERY_BY_ADDRESS;
                switchedToAddressQuery = true;
                skip = 0;
                best = null;
                continue;
            }
            throw error;
        }

        const events = data.poolEvents || [];
        for (const event of events) {
            const maybeSwap = event as Partial<PoolSwapEvent>;
            if (maybeSwap.blockNumber === undefined || !maybeSwap.tx) {
                continue;
            }
            const blockNumber = toNumber(maybeSwap.blockNumber, 'blockNumber');
            if (!best || blockNumber < best.blockNumber) {
                best = { blockNumber, tx: maybeSwap.tx };
            }
        }

        if (events.length < PAGE_SIZE) {
            break;
        }
        skip += PAGE_SIZE;
    }

    return best;
}

async function getCreatedBlockResolver() {
    const provider = new providers.JsonRpcProvider(MAINNET_RPC_URL);
    const latestBlock = await provider.getBlockNumber();
    const blockTimestampCache = new Map<number, number>();
    const createdBlockCache = new Map<number, number>();

    async function getBlockTimestamp(blockNumber: number): Promise<number> {
        const cached = blockTimestampCache.get(blockNumber);
        if (cached !== undefined) {
            return cached;
        }
        const block = await provider.getBlock(blockNumber);
        if (!block) {
            throw new Error(`Failed to fetch block ${blockNumber}`);
        }
        const timestamp = Number(block.timestamp);
        blockTimestampCache.set(blockNumber, timestamp);
        return timestamp;
    }

    return async function resolveCreatedBlock(createTime: number): Promise<number> {
        const cached = createdBlockCache.get(createTime);
        if (cached !== undefined) {
            return cached;
        }

        let low = 0;
        let high = latestBlock;
        let answer = 0;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const ts = await getBlockTimestamp(mid);
            if (ts <= createTime) {
                answer = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        createdBlockCache.set(createTime, answer);
        return answer;
    };
}

function formatTimestamp(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString();
}

function pad(value: string | number, width: number): string {
    const str = String(value);
    if (str.length >= width) {
        return str;
    }
    return `${str}${' '.repeat(width - str.length)}`;
}

function printReport(rows: PoolWithEarliestSwap[], totalPools: number): void {
    console.log('');
    console.log('RECLAMM Earliest SWAP Report (MAINNET)');
    console.log('--------------------------------------');
    console.log(`Total RECLAMM pools fetched: ${totalPools}`);
    console.log(`Pools with at least one SWAP: ${rows.length}`);
    console.log('');

    const headers = [
        pad('Pool', 44),
        pad('Create Time (UTC)', 24),
        pad('Created Block', 14),
        pad('Earliest Swap', 14),
        pad('Delta', 10),
        'Tx',
    ];
    console.log(headers.join('  '));
    console.log('-'.repeat(150));

    for (const row of rows) {
        console.log(
            [
                pad(row.address, 44),
                pad(formatTimestamp(row.createTime), 24),
                pad(row.createdBlock, 14),
                pad(row.earliestSwapBlock, 14),
                pad(row.blockDelta, 10),
                row.earliestSwapTx,
            ].join('  ')
        );
    }
}

async function main(): Promise<void> {
    const startMs = Date.now();
    console.log('Fetching MAINNET RECLAMM pools from Balancer API...');

    const pools = await fetchAllReclammPools();
    console.log(`Fetched ${pools.length} pools. Resolving created blocks and events...`);

    const resolveCreatedBlock = await getCreatedBlockResolver();
    const rows: PoolWithEarliestSwap[] = [];

    for (let i = 0; i < pools.length; i += 1) {
        const pool = pools[i];
        const progress = `${i + 1}/${pools.length}`;
        console.log(`[${progress}] ${pool.address}`);

        const createdBlock = await resolveCreatedBlock(pool.createTime);
        const earliestSwap = await fetchEarliestSwapBlockAndTx(pool.address);
        if (!earliestSwap) {
            continue;
        }

        rows.push({
            address: pool.address,
            createTime: pool.createTime,
            createdBlock,
            earliestSwapBlock: earliestSwap.blockNumber,
            earliestSwapTx: earliestSwap.tx,
            blockDelta: earliestSwap.blockNumber - createdBlock,
        });
    }

    rows.sort((a, b) => {
        if (a.blockDelta !== b.blockDelta) {
            return a.blockDelta - b.blockDelta;
        }
        if (a.earliestSwapBlock !== b.earliestSwapBlock) {
            return a.earliestSwapBlock - b.earliestSwapBlock;
        }
        return a.address.localeCompare(b.address);
    });

    printReport(rows, pools.length);
    console.log('');
    console.log(`Completed in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
}

if (require.main === module) {
    main().catch((error) => {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Unknown error occurred');
        }
        process.exit(1);
    });
}
