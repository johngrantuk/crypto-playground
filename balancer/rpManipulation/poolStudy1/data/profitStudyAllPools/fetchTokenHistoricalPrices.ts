import { graphQlRequestWithDelay } from './graphQlClient';
import { PROFIT_STUDY_ALL_POOLS } from './config';
import { prepareSortedPriceSeries } from './priceAtOrBefore';
import type { PricePoint } from './types';

function tokenKey(address: string): string {
    return address.trim().toLowerCase();
}

type HistResponse = {
    tokenGetHistoricalPrices?: Array<{
        address: string;
        prices: Array<{ price: number; timestamp: string | number }>;
    }>;
};

const HIST_PRICES_QUERY = `
  query TokenHistPrices(
    $addresses: [String!]!
    $chain: GqlChain!
    $range: GqlTokenChartDataRange!
  ) {
    tokenGetHistoricalPrices(
      addresses: $addresses
      chain: $chain
      range: $range
    ) {
      address
      prices {
        price
        timestamp
      }
    }
  }
`;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

/**
 * Fetch ALL historical price series for the given token addresses (Base),
 * sorted ascending by timestamp for each token.
 */
export async function fetchHistoricalPricesMap(
    uniqueAddresses: string[]
): Promise<Map<string, PricePoint[]>> {
    const map = new Map<string, PricePoint[]>();
    const keys = [...new Set(uniqueAddresses.map(tokenKey))].filter(Boolean);
    const batchSize = PROFIT_STUDY_ALL_POOLS.historicalPricesBatchSize;

    for (const batch of chunk(keys, batchSize)) {
        if (batch.length === 0) {
            continue;
        }
        const data = await graphQlRequestWithDelay<HistResponse>(
            HIST_PRICES_QUERY,
            {
                addresses: batch,
                chain: 'BASE',
                range: 'ALL',
            }
        );
        const rows = data.tokenGetHistoricalPrices ?? [];
        for (const row of rows) {
            const k = tokenKey(row.address);
            map.set(k, prepareSortedPriceSeries(row.prices ?? []));
        }
    }

    return map;
}
