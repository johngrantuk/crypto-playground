// npx ts-node balancer/api/fetchPoolsWithRateProvider.ts
import fetch from 'isomorphic-fetch';

const API_ENDPOINT = 'https://test-api-v3.balancer.fi/';
const RATE_PROVIDER_ADDRESS = '0x6598f108273a1b86563ebcf2b780468f3f431af7';
const PAUSE_MANAGER_ADDRESS = '0x000000f15851d0875e878a83451163999bf5da51';

const GRAPHQL_QUERY = `
  query MyQuery {
    poolGetPools(where: {chainIn: BASE, protocolVersionIn: 3}) {
      id
      poolTokens {
        address
        priceRateProvider
        symbol
      }
      poolCreator
      owner
      pauseManager
      type
    }
  }
`;

interface PoolToken {
    address: string;
    priceRateProvider: string | null;
    symbol: string;
}

interface Pool {
    id: string;
    poolTokens: PoolToken[];
    poolCreator: string;
    owner: string;
    pauseManager: string;
    type: string;
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

function filterPoolsByRateProvider(
    pools: Pool[],
    rateProviderAddress: string
): Pool[] {
    const normalizedAddress = rateProviderAddress.toLowerCase();

    return pools.filter((pool) => {
        return pool.poolTokens.some((token) => {
            if (!token.priceRateProvider) {
                return false;
            }
            return token.priceRateProvider.toLowerCase() === normalizedAddress;
        });
    });
}

function filterPoolsByPauseManager(
    pools: Pool[],
    pauseManagerAddress: string
): Pool[] {
    const normalizedAddress = pauseManagerAddress.toLowerCase();

    return pools.filter((pool) => {
        return pool.pauseManager.toLowerCase() === normalizedAddress;
    });
}

function logPoolDetails(pools: Pool[], rateProviderAddress: string): void {
    pools.forEach((pool, index) => {
        console.log(`Pool ${index + 1}:`);
        console.log(`  ID: ${pool.id}`);
        console.log(`  Type: ${pool.type}`);
        console.log(`  Owner: ${pool.owner}`);
        console.log(`  Pool Creator: ${pool.poolCreator}`);
        console.log(`  Pause Manager: ${pool.pauseManager}`);
        console.log(`  Tokens:`);
        pool.poolTokens.forEach((token) => {
            const hasRateProvider =
                token.priceRateProvider?.toLowerCase() ===
                rateProviderAddress.toLowerCase();
            const marker = hasRateProvider ? ' ⭐' : '';
            console.log(`    - ${token.symbol} (${token.address})${marker}`);
            if (token.priceRateProvider) {
                console.log(`      Rate Provider: ${token.priceRateProvider}`);
            }
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
            `\nFiltering pools with rate provider: ${RATE_PROVIDER_ADDRESS}`
        );
        const filteredPools = filterPoolsByRateProvider(
            allPools,
            RATE_PROVIDER_ADDRESS
        );
        console.log(`Found ${filteredPools.length} matching pools\n`);

        if (filteredPools.length === 0) {
            console.log('No pools found with the specified rate provider.');
        } else {
            logPoolDetails(filteredPools, RATE_PROVIDER_ADDRESS);
        }

        console.log(
            `\nFiltering pools with pause manager: ${PAUSE_MANAGER_ADDRESS}`
        );
        const pauseManagerPools = filterPoolsByPauseManager(
            allPools,
            PAUSE_MANAGER_ADDRESS
        );
        console.log(`Found ${pauseManagerPools.length} matching pools\n`);

        if (pauseManagerPools.length === 0) {
            console.log('No pools found with the specified pause manager.');
        } else {
            logPoolDetails(pauseManagerPools, RATE_PROVIDER_ADDRESS);
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
