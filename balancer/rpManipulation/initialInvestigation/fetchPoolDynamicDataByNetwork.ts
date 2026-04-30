// npx ts-node balancer/api/fetchPoolDynamicDataByNetwork.ts
import fetch from 'isomorphic-fetch';
import { readFileSync, writeFileSync } from 'fs';

const API_ENDPOINT = 'https://api-v3.balancer.fi/';
const PAGE_SIZE = 200;

type NetworkKey = 'arbitrum' | 'base';
type ChainEnum = 'ARBITRUM' | 'BASE';

interface NetworkConfig {
    chainEnum: ChainEnum;
    chainSlug: NetworkKey;
    defaultInputPath: string;
    defaultOutputPath: string;
}

const NETWORK: NetworkKey =
    (process.env.NETWORK as NetworkKey | undefined) || 'arbitrum';

const NETWORK_CONFIG: Record<NetworkKey, NetworkConfig> = {
    arbitrum: {
        chainEnum: 'ARBITRUM',
        chainSlug: 'arbitrum',
        defaultInputPath: 'balancer/eoaPoolCreationArbi.results.json',
        defaultOutputPath:
            'balancer/api/fetchPoolDynamicDataByNetwork.arbitrum.results.json',
    },
    base: {
        chainEnum: 'BASE',
        chainSlug: 'base',
        defaultInputPath: 'balancer/eoaPoolCreationBase.results.json',
        defaultOutputPath:
            'balancer/api/fetchPoolDynamicDataByNetwork.base.results.json',
    },
};

interface EoaPoolRecord {
    network?: string;
    poolAddress: string;
}

interface DynamicData {
    lifetimeSwapFees: string | null;
    lifetimeVolume: string | null;
    totalLiquidityAth: string | null;
    totalLiquidity: string | null;
    totalLiquidityAthTimestamp: number | null;
}

interface ApiPool {
    address: string;
    id: string;
    protocolVersion: number;
    dynamicData: DynamicData | null;
}

interface PoolGetPoolsResponse {
    poolGetPools?: ApiPool[];
}

interface GraphQlError {
    message: string;
}

interface GraphQlResponse<T> {
    data?: T;
    errors?: GraphQlError[];
}

interface OutputRow {
    poolAddress: string;
    poolId: string;
    protocolVersion: number;
    dynamicData: DynamicData | null;
    balancerUrl: string | null;
}

const POOLS_QUERY = `
  query PoolsByChain($first: Int!, $skip: Int!) {
    poolGetPools(
      where: { chainIn: ${NETWORK_CONFIG[NETWORK].chainEnum} }
      first: $first
      skip: $skip
    ) {
      address
      id
      protocolVersion
      dynamicData {
        lifetimeSwapFees
        lifetimeVolume
        totalLiquidityAth
        totalLiquidity
        totalLiquidityAthTimestamp
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
            `API request failed with status ${response.status}: ${body}`
        );
    }

    const result: GraphQlResponse<T> = await response.json();
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

async function fetchAllPools(): Promise<ApiPool[]> {
    const pools: ApiPool[] = [];
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
        const data = await graphQlRequest<PoolGetPoolsResponse>(POOLS_QUERY, {
            first: PAGE_SIZE,
            skip,
        });
        const page = data.poolGetPools || [];
        pools.push(...page);
        console.log(
            `Fetched pool page skip=${skip} size=${page.length} total=${pools.length}`
        );

        if (page.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            skip += PAGE_SIZE;
        }
    }

    return pools;
}

function normalizeAddress(value: string): string {
    return value.toLowerCase();
}

function toNumeric(value: string | null | undefined): number {
    if (!value) {
        return 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildBalancerUrl(
    chainSlug: string,
    protocolVersion: number,
    poolId: string,
    poolAddress: string
): string | null {
    if (protocolVersion === 2) {
        return `https://balancer.fi/pools/${chainSlug}/v2/${poolId}`;
    }
    if (protocolVersion === 3) {
        return `https://balancer.fi/pools/${chainSlug}/v3/${poolAddress}`;
    }
    return null;
}

function readInputRecords(path: string): EoaPoolRecord[] {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`Expected array in input file: ${path}`);
    }
    return parsed as EoaPoolRecord[];
}

function warnOnNetworkMismatch(
    records: EoaPoolRecord[],
    selectedNetwork: NetworkKey
): void {
    const found = new Set<string>();
    for (const record of records) {
        if (record.network) {
            found.add(record.network.toLowerCase());
        }
    }
    if (found.size === 0) {
        return;
    }
    if (!found.has(selectedNetwork)) {
        console.warn(
            `Warning: input file network values (${Array.from(found).join(
                ', '
            )}) do not include selected network (${selectedNetwork}).`
        );
    }
}

function buildOutputRows(
    inputRecords: EoaPoolRecord[],
    pools: ApiPool[],
    chainSlug: string
): { matched: OutputRow[]; unmatched: string[]; uniqueInputCount: number } {
    const poolsByAddress = new Map<string, ApiPool>();
    for (const pool of pools) {
        poolsByAddress.set(normalizeAddress(pool.address), pool);
    }

    const uniqueInputAddresses = Array.from(
        new Set(
            inputRecords
                .map((record) => record.poolAddress)
                .filter((addr): addr is string => Boolean(addr))
                .map((addr) => normalizeAddress(addr))
        )
    );

    const matched: OutputRow[] = [];
    const unmatched: string[] = [];

    for (const normalizedInputAddress of uniqueInputAddresses) {
        const pool = poolsByAddress.get(normalizedInputAddress);
        if (!pool) {
            unmatched.push(normalizedInputAddress);
            continue;
        }
        matched.push({
            poolAddress: pool.address,
            poolId: pool.id,
            protocolVersion: pool.protocolVersion,
            dynamicData: pool.dynamicData,
            balancerUrl: buildBalancerUrl(
                chainSlug,
                pool.protocolVersion,
                pool.id,
                pool.address
            ),
        });
    }

    matched.sort((a, b) => {
        const aLifetimeSwapFees = toNumeric(a.dynamicData?.lifetimeSwapFees);
        const bLifetimeSwapFees = toNumeric(b.dynamicData?.lifetimeSwapFees);
        if (aLifetimeSwapFees !== bLifetimeSwapFees) {
            return bLifetimeSwapFees - aLifetimeSwapFees;
        }
        return a.poolAddress.localeCompare(b.poolAddress);
    });

    return {
        matched,
        unmatched,
        uniqueInputCount: uniqueInputAddresses.length,
    };
}

function printRows(rows: OutputRow[]): void {
    for (const row of rows) {
        console.log(`poolAddress: ${row.poolAddress}`);
        console.log(`protocolVersion: ${row.protocolVersion}`);
        console.log(`dynamicData: ${JSON.stringify(row.dynamicData)}`);
        console.log(`balancerUrl: ${row.balancerUrl ?? 'null'}`);
        console.log('');
    }
}

async function main(): Promise<void> {
    const startMs = Date.now();
    const config = NETWORK_CONFIG[NETWORK];
    if (!config) {
        throw new Error(`Unsupported NETWORK: ${NETWORK}`);
    }

    const inputPath = process.env.INPUT_FILE || config.defaultInputPath;
    const outputPath = process.env.OUTPUT_FILE || config.defaultOutputPath;

    console.log(`Network: ${NETWORK}`);
    console.log(`Input file: ${inputPath}`);
    console.log(`Output file: ${outputPath}`);

    const inputRecords = readInputRecords(inputPath);
    warnOnNetworkMismatch(inputRecords, NETWORK);

    const pools = await fetchAllPools();
    const result = buildOutputRows(inputRecords, pools, config.chainSlug);

    printRows(result.matched);

    console.log('Summary');
    console.log('-------');
    console.log(`Input rows: ${inputRecords.length}`);
    console.log(`Unique input pool addresses: ${result.uniqueInputCount}`);
    console.log(`Matched pools: ${result.matched.length}`);
    console.log(`Unmatched pools: ${result.unmatched.length}`);

    if (result.unmatched.length > 0) {
        console.log('Unmatched addresses:');
        for (const addr of result.unmatched) {
            console.log(`- ${addr}`);
        }
    }

    writeFileSync(outputPath, JSON.stringify(result.matched, null, 2));
    console.log(`Wrote JSON output to ${outputPath}`);
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
