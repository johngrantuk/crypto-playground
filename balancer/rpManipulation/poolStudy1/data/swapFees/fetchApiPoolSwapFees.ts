// npx ts-node balancer/rpManipulation/poolStudy1/data/swapFees/fetchApiPoolSwapFees.ts
import fetch from 'isomorphic-fetch';
import { writeFileSync } from 'fs';

const API_ENDPOINT = 'https://api-v3.balancer.fi/';
const PAGE_SIZE = 1000;
const POOL_ID =
    '0x10bdbb4fe8dfd348d44397eedabb737df68bc9a0000200000000000000000248';
const OUTPUT_FILE =
    'balancer/rpManipulation/poolStudy1/data/swapFees/swapFees.json';

type SwapFee = {
    valueUSD: string;
};

type PoolSwapFeeEvent = {
    tx: string;
    type: string;
    blockNumber: string | number;
    fee?: SwapFee | null;
};

type GraphQLError = { message: string };
type GraphQLResponse<T> = {
    data?: T;
    errors?: GraphQLError[];
};

type PoolEventsResponse = {
    poolEvents?: PoolSwapFeeEvent[];
};

const POOL_SWAP_FEES_QUERY = `
  query PoolSwapFeeEvents($poolId: String!, $first: Int!, $skip: Int!) {
    poolEvents(
      where: { chainIn: BASE, poolId: $poolId, type: SWAP }
      first: $first
      skip: $skip
    ) {
      tx
      type
      blockNumber
      ... on GqlPoolSwapEventV3 {
        fee {
          valueUSD
        }
      }
    }
  }
`;

function toNumber(value: string | number, label: string): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid ${label}: ${String(value)}`);
    }
    return n;
}

async function graphQlRequest<T>(
    query: string,
    variables: Record<string, unknown>
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
            `API request failed with status ${response.status}: ${body}`
        );
    }

    const result: GraphQLResponse<T> = await response.json();
    if (result.errors && result.errors.length > 0) {
        throw new Error(result.errors.map((e) => e.message).join('; '));
    }
    if (!result.data) {
        throw new Error('GraphQL response missing data');
    }

    return result.data;
}

async function fetchAllSwapFeeEvents(): Promise<PoolSwapFeeEvent[]> {
    const events: PoolSwapFeeEvent[] = [];
    let skip = 0;
    let pageCount = 0;

    while (true) {
        const data = await graphQlRequest<PoolEventsResponse>(
            POOL_SWAP_FEES_QUERY,
            {
                poolId: POOL_ID,
                first: PAGE_SIZE,
                skip,
            }
        );

        const page = data.poolEvents ?? [];
        events.push(...page);
        pageCount += 1;
        console.log(
            `Fetched page ${pageCount}: ${page.length} rows (running total: ${events.length})`
        );

        if (page.length < PAGE_SIZE) {
            break;
        }

        skip += PAGE_SIZE;
    }

    return events;
}

async function main(): Promise<void> {
    console.log(`Fetching SWAP fee events for pool ${POOL_ID}...`);
    const events = await fetchAllSwapFeeEvents();

    const sorted = [...events].sort(
        (a, b) =>
            toNumber(a.blockNumber, 'blockNumber') -
            toNumber(b.blockNumber, 'blockNumber')
    );

    writeFileSync(OUTPUT_FILE, JSON.stringify(sorted, null, 2), 'utf8');
    console.log(`Saved ${sorted.length} SWAP fee events to ${OUTPUT_FILE}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
