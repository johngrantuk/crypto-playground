// npx ts-node balancer/api/fetchNewFactoryPools.ts
import fetch from 'isomorphic-fetch';

const API_ENDPOINT = 'https://api-v3.balancer.fi/';

const GRAPHQL_QUERY = `
  query MyQuery {
    poolGetPools(
      where: {protocolVersionIn: 3, chainNotIn: SONIC, poolTypeIn: [STABLE, WEIGHTED]}
      orderBy: totalLiquidity
    ) {
      address
      chain
      version
      poolTokens {
        isErc4626
        symbol
      }
      type
      hook {
        name
        address
        reviewData {
          summary
          reviewFile
        }
      }
      dynamicData {
        totalLiquidity
      }
    }
  }
`;

interface PoolToken {
    isErc4626: boolean;
    symbol: string;
}

interface ReviewData {
    summary: string | null;
    reviewFile: string | null;
}

interface Hook {
    name: string;
    address: string;
    reviewData: ReviewData | null;
}

interface DynamicData {
    totalLiquidity: string;
}

interface Pool {
    address: string;
    chain: string;
    version: number;
    poolTokens: PoolToken[];
    type: string;
    hook: Hook | null;
    dynamicData: DynamicData | null;
}

interface GraphQLResponse {
    data?: {
        poolGetPools?: Pool[];
    };
    errors?: Array<{ message: string }>;
}

async function fetchPools(): Promise<Pool[]> {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: GRAPHQL_QUERY }),
        });

        if (!response.ok) {
            throw new Error(
                `API request failed with status: ${response.status}`
            );
        }

        const result: GraphQLResponse = await response.json();

        if (result.errors) {
            throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        }

        if (!result.data || !result.data.poolGetPools) {
            throw new Error('Invalid response structure: missing poolGetPools');
        }

        return result.data.poolGetPools;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch pools: ${error.message}`);
        }
        throw new Error('Failed to fetch pools: Unknown error');
    }
}

function getBalancerPoolUrl(chain: string, address: string): string {
    const chainLower = chain.toLowerCase();
    return `https://balancer.fi/pools/${chainLower}/v3/${address}`;
}

function filterPoolsByVersion(pools: Pool[]): Pool[] {
    return pools.filter((pool) => {
        const isWeightedV2 = pool.type === 'WEIGHTED' && pool.version === 2;
        const isStableV2Plus = pool.type === 'STABLE' && pool.version === 3;
        return isWeightedV2 || isStableV2Plus;
    });
}

function logPoolDetails(pools: Pool[]): void {
    pools.forEach((pool, index) => {
        console.log(`Pool ${index + 1}:`);
        console.log(`  Address: ${pool.address}`);
        console.log(`  Chain: ${pool.chain}`);
        console.log(`  Type: ${pool.type}`);
        console.log(`  Version: ${pool.version}`);
        console.log(
            `  Balancer URL: ${getBalancerPoolUrl(pool.chain, pool.address)}`
        );
        if (pool.hook) {
            console.log(`  Hook: ${pool.hook.name}`);
            console.log(`  Hook Address: ${pool.hook.address}`);
            if (pool.hook.reviewData) {
                if (pool.hook.reviewData.summary) {
                    console.log(
                        `  Hook Review Summary: ${pool.hook.reviewData.summary}`
                    );
                }
                if (pool.hook.reviewData.reviewFile) {
                    console.log(
                        `  Hook Review File: ${pool.hook.reviewData.reviewFile}`
                    );
                }
            }
        }
        if (pool.dynamicData) {
            console.log(
                `  Total Liquidity: ${pool.dynamicData.totalLiquidity}`
            );
        }
        console.log(`  Tokens:`);
        pool.poolTokens.forEach((token) => {
            const erc4626Marker = token.isErc4626 ? ' (ERC4626)' : '';
            console.log(`    - ${token.symbol}${erc4626Marker}`);
        });
        console.log('');
    });
}

async function main(): Promise<void> {
    try {
        console.log('Fetching pools from Balancer API v3...');
        const allPools = await fetchPools();
        console.log(`Fetched ${allPools.length} total pools`);

        console.log(
            '\nFiltering pools: weighted pools (version 2) OR stable pools (version >= 2)'
        );
        const filteredPools = filterPoolsByVersion(allPools);
        console.log(`Found ${filteredPools.length} matching pools\n`);

        if (filteredPools.length === 0) {
            console.log('No pools found matching the version criteria.');
        } else {
            logPoolDetails(filteredPools);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        } else {
            console.error('Unknown error occurred');
        }
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}
