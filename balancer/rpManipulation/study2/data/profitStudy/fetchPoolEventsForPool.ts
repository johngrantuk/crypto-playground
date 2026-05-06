import type { ProfitStudyConfig } from './config';
import { graphQlRequestWithDelay } from './graphQlClient';

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
  query PoolEventsAllTypes(
    $network: GqlChain!
    $poolId: String!
    $first: Int!
    $skip: Int!
  ) {
    poolEvents(
      where: { chainIn: [$network], poolId: $poolId }
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

export async function fetchAllPoolEventsForPool(params: {
    config: ProfitStudyConfig;
    poolId: string;
}): Promise<RawPoolEventRow[]> {
    const { config, poolId } = params;
    const events: RawPoolEventRow[] = [];
    let skip = 0;
    const first = config.poolEventsPageSize;

    while (true) {
        const data = await graphQlRequestWithDelay<PoolEventsResponse>({
            config,
            query: POOL_EVENTS_QUERY,
            variables: { network: config.network, poolId, first, skip },
        });
        const page = data.poolEvents ?? [];
        events.push(...page);
        if (page.length < first) {
            break;
        }
        skip += first;
    }

    return events;
}
