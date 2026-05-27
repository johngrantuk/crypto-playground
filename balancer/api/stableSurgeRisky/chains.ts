import { gqlRequest, withRetry } from './graphql';
import { GqlChain, ProtocolMetricsChain } from './types';

export const ACTIVE_GQL_CHAINS: GqlChain[] = [
    'ARBITRUM',
    'AVALANCHE',
    'BASE',
    'GNOSIS',
    'HYPEREVM',
    'MAINNET',
    'MONAD',
    'OPTIMISM',
    'PLASMA',
];

export const GQL_CHAIN_TO_CHAIN_ID: Record<GqlChain, number> = {
    MAINNET: 1,
    BASE: 8453,
    ARBITRUM: 42161,
    AVALANCHE: 43114,
    GNOSIS: 100,
    HYPEREVM: 999,
    MONAD: 143,
    OPTIMISM: 10,
    PLASMA: 9745,
};

/** Balancer.fi UI path segment per GqlChain (not always enum.toLowerCase()). */
export const GQL_CHAIN_TO_UI_SLUG: Record<GqlChain, string> = {
    MAINNET: 'ethereum',
    ARBITRUM: 'arbitrum',
    AVALANCHE: 'avalanche',
    BASE: 'base',
    GNOSIS: 'gnosis',
    HYPEREVM: 'hyperevm',
    MONAD: 'monad',
    OPTIMISM: 'optimism',
    PLASMA: 'plasma',
};

export function balancerPoolUrl(chain: GqlChain, poolAddress: string): string {
    const slug = GQL_CHAIN_TO_UI_SLUG[chain];
    return `https://balancer.fi/pools/${slug}/v3/${poolAddress.toLowerCase()}`;
}

const CHAIN_ID_TO_GQL_CHAIN = new Map<number, GqlChain>(
    Object.entries(GQL_CHAIN_TO_CHAIN_ID).map(([chain, id]) => [
        id,
        chain as GqlChain,
    ])
);

const DISCOVER_CHAINS_QUERY = `
  query DiscoverActiveChains($chains: [GqlChain!]!) {
    protocolMetricsAggregated(chains: $chains) {
      chains {
        chainId
        poolCount
      }
    }
  }
`;

interface DiscoverChainsData {
    protocolMetricsAggregated: {
        chains: ProtocolMetricsChain[];
    };
}

function parsePoolCount(value: string | number): number {
    if (typeof value === 'number') {
        return value;
    }
    try {
        return Number(BigInt(value));
    } catch {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }
}

export async function discoverActiveChains(): Promise<GqlChain[]> {
    const data = await withRetry(() =>
        gqlRequest<DiscoverChainsData>(DISCOVER_CHAINS_QUERY, {
            chains: ACTIVE_GQL_CHAINS,
        })
    );

    const active = new Set<GqlChain>();
    for (const row of data.protocolMetricsAggregated.chains) {
        const chainId = parseInt(row.chainId, 10);
        if (!Number.isFinite(chainId)) {
            console.warn(`[chains] invalid chainId: ${row.chainId}`);
            continue;
        }
        const gqlChain = CHAIN_ID_TO_GQL_CHAIN.get(chainId);
        if (!gqlChain) {
            console.warn(`[chains] unknown chainId ${chainId}, skipping`);
            continue;
        }
        if (parsePoolCount(row.poolCount) > 0) {
            active.add(gqlChain);
        }
    }

    return ACTIVE_GQL_CHAINS.filter((c) => active.has(c));
}

export function chainIdForGqlChain(chain: GqlChain): number {
    return GQL_CHAIN_TO_CHAIN_ID[chain];
}
