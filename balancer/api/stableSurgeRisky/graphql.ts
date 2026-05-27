import fetch from 'isomorphic-fetch';
import { AuditPoolRow, GqlChain, StablePool } from './types';

export const API_ENDPOINT = 'https://api-v3.balancer.fi/';

type GraphQLError = { message: string };
type GraphQLResponse<T> = {
    data?: T;
    errors?: GraphQLError[];
};

const RETRY_DELAYS_MS = [500, 1500, 4500];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gqlRequest<T>(
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

export async function withRetry<T>(
    fn: () => Promise<T>,
    opts?: { delaysMs?: number[] }
): Promise<T> {
    const delays = opts?.delaysMs ?? RETRY_DELAYS_MS;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError =
                err instanceof Error ? err : new Error(String(err));
            if (attempt >= delays.length) {
                break;
            }
            const waitMs = delays[attempt];
            console.warn(
                `[retry] attempt ${attempt + 1}/${delays.length} failed: ${lastError.message}; waiting ${waitMs}ms`
            );
            await sleep(waitMs);
        }
    }

    throw lastError ?? new Error('Request failed after retries');
}

const STABLE_POOLS_QUERY = `
  query StablePools($first: Int!, $skip: Int!, $chains: [GqlChain!]) {
    poolGetPools(
      first: $first
      skip: $skip
      where: {
        chainIn: $chains
        protocolVersionIn: [3]
        poolTypeIn: [STABLE]
        minTvl: 10000
      }
    ) {
      address
      chain
      hook {
        type
        address
        dynamicData {
          maxSurgeFeePercentage
          surgeThresholdPercentage
        }
      }
      poolTokens { address }
      dynamicData {
        totalLiquidity
        volume24h
        isPaused
        isInRecoveryMode
      }
    }
  }
`;

interface StablePoolsData {
    poolGetPools: StablePool[];
}

const PAGE_SIZE = 100;
const OWNER_FETCH_CONCURRENCY = 8;

// poolGetPools returns owner: null; poolGetPool returns the on-chain owner.
const POOL_OWNER_QUERY = `
  query PoolOwner($chain: GqlChain!, $id: String!) {
    poolGetPool(chain: $chain, id: $id) {
      owner
    }
  }
`;

interface PoolOwnerData {
    poolGetPool: { owner?: string | null };
}

async function fetchPoolOwner(
    chain: GqlChain,
    poolAddress: string
): Promise<string | null> {
    const data = await withRetry(() =>
        gqlRequest<PoolOwnerData>(POOL_OWNER_QUERY, {
            chain,
            id: poolAddress,
        })
    );
    const owner = data.poolGetPool?.owner;
    return owner ? owner.toLowerCase() : null;
}

export async function enrichRiskyPoolOwners(
    rows: AuditPoolRow[]
): Promise<AuditPoolRow[]> {
    const risky = rows.filter((r) => r.surge_excluded);
    if (risky.length === 0) {
        return rows;
    }

    const ownerByKey = new Map<string, string | null>();

    for (let i = 0; i < risky.length; i += OWNER_FETCH_CONCURRENCY) {
        const batch = risky.slice(i, i + OWNER_FETCH_CONCURRENCY);
        const owners = await Promise.all(
            batch.map((r) => fetchPoolOwner(r.chain, r.pool))
        );
        for (let j = 0; j < batch.length; j++) {
            ownerByKey.set(`${batch[j].chain}:${batch[j].pool}`, owners[j]);
        }
    }

    return rows.map((row) => {
        if (!row.surge_excluded) {
            return row;
        }
        const owner = ownerByKey.get(`${row.chain}:${row.pool}`) ?? null;
        return { ...row, owner };
    });
}

export async function fetchAllStablePools(
    chains: GqlChain[]
): Promise<StablePool[]> {
    const all: StablePool[] = [];
    let skip = 0;

    while (true) {
        const page = await withRetry(() =>
            gqlRequest<StablePoolsData>(STABLE_POOLS_QUERY, {
                first: PAGE_SIZE,
                skip,
                chains,
            })
        );
        const pools = page.poolGetPools ?? [];
        all.push(...pools);
        if (pools.length < PAGE_SIZE) {
            break;
        }
        skip += PAGE_SIZE;
    }

    return all;
}
