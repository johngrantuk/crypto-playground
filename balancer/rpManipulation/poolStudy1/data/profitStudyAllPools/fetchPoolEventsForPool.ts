import { graphQlRequestWithDelay } from './graphQlClient';
import { PROFIT_STUDY_ALL_POOLS } from './config';

/** Raw row from poolEvents; ADD/REMOVE rows include fragment fields. */
export type RawPoolEventRow = {
    type: string;
    tx: string;
    blockNumber: number | string;
    id?: string;
    sender?: string;
    timestamp?: number;
    valueUSD?: number;
    tokens?: Array<{ address: string; amount: string }>;
};

type PoolEventsResponse = {
    poolEvents?: RawPoolEventRow[];
};

const POOL_EVENTS_QUERY = `
  query PoolEventsAllTypes($poolId: String!, $first: Int!, $skip: Int!) {
    poolEvents(
      where: { chainIn: BASE, poolId: $poolId }
      first: $first
      skip: $skip
    ) {
      type
      tx
      blockNumber
      ... on GqlPoolAddRemoveEventV3 {
        id
        poolId
        sender
        timestamp
        valueUSD
        tokens {
          address
          amount
        }
      }
    }
  }
`;

export async function fetchAllPoolEventsForPool(
    poolId: string
): Promise<RawPoolEventRow[]> {
    const events: RawPoolEventRow[] = [];
    let skip = 0;
    const first = PROFIT_STUDY_ALL_POOLS.poolEventsPageSize;

    while (true) {
        const data = await graphQlRequestWithDelay<PoolEventsResponse>(
            POOL_EVENTS_QUERY,
            { poolId, first, skip }
        );
        const page = data.poolEvents ?? [];
        events.push(...page);
        if (page.length < first) {
            break;
        }
        skip += first;
    }

    return events;
}
