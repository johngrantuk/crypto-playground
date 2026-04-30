// npx ts-node balancer/eoaPoolCreation.ts
import 'dotenv/config';
import fetch from 'isomorphic-fetch';
import { writeFileSync } from 'fs';

type Address = `0x${string}`;
type Hex = `0x${string}`;
type Chain = unknown;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const viem = require('viem') as {
    createPublicClient: (params: { chain: Chain; transport: unknown }) => {
        getTransactionReceipt: (params: { hash: Hex }) => Promise<{
            logs: Array<{
                data: Hex;
                address: Address;
                logIndex?: number | bigint;
                topics?: readonly Hex[];
            }>;
        }>;
    };
    decodeEventLog: (params: {
        abi: unknown[];
        data: Hex;
        topics: [Hex, ...Hex[]] | [];
    }) => { eventName?: string; args?: { pool?: Address } };
    getAddress: (value: string) => Address;
    http: (url: string) => unknown;
    parseAbiItem: (signature: string) => unknown;
};

const { createPublicClient, decodeEventLog, getAddress, http, parseAbiItem } =
    viem;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { arbitrum, base } = require('viem/chains') as {
    arbitrum: Chain;
    base: Chain;
};

type NetworkKey = 'arbitrum' | 'base';

type DataSource = 'explorer' | 'blockscout';

interface NetworkConfig {
    chain: Chain;
    chainId: number;
    explorerApiBaseUrl: string;
    explorerApiKeyEnvVar: string;
    blockscoutApiBaseUrl: string;
    rpcUrlEnvVar: string;
}

interface RuntimeConfig {
    network: NetworkKey;
    eoa: Address;
    startBlock?: bigint;
    endBlock?: bigint;
    outputFilePath: string;
    pageSize: number;
    maxTxs?: number;
    receiptConcurrency: number;
    maxRetries: number;
    retryDelayMs: number;
}

interface ArbiscanNormalTx {
    hash: Hex;
    from: Address;
    blockNumber: string;
    timeStamp: string;
}

interface ArbiscanResponse<T> {
    status: string;
    message: string;
    result: T;
}

interface EoaTx {
    hash: Hex;
    blockNumber: bigint;
    timestamp: number;
}

interface PoolCreatedEventRecord {
    network: NetworkKey;
    eoa: Address;
    txHash: Hex;
    blockNumber: bigint;
    timestamp: number;
    factoryAddress: Address;
    poolAddress: Address;
    logIndex: number;
}

const NETWORK_CONFIG: Record<NetworkKey, NetworkConfig> = {
    arbitrum: {
        chain: arbitrum,
        chainId: 42161,
        explorerApiBaseUrl: 'https://api.etherscan.io/v2/api',
        explorerApiKeyEnvVar: 'ARBISCAN_API_KEY',
        blockscoutApiBaseUrl: 'https://arbitrum.blockscout.com/api',
        rpcUrlEnvVar: 'ARBITRUM_RPC_URL',
    },
    base: {
        chain: base,
        chainId: 8453,
        explorerApiBaseUrl: 'https://api.etherscan.io/v2/api',
        explorerApiKeyEnvVar: 'BASESCAN_API_KEY',
        blockscoutApiBaseUrl: 'https://base.blockscout.com/api',
        rpcUrlEnvVar: 'BASE_RPC_URL',
    },
};

// Set network and data source locally in this file.
const NETWORK: NetworkKey = 'base';
const DATA_SOURCE: DataSource = 'blockscout';

const runtimeConfig: RuntimeConfig = {
    network: NETWORK,
    eoa: getAddress(
        process.env.EOA || '0x91906bE1391D2fC7D01A7A6757c69dAaefd2C257'
    ),
    startBlock:
        process.env.START_BLOCK !== undefined
            ? BigInt(process.env.START_BLOCK)
            : 39419563n,
    endBlock:
        process.env.END_BLOCK !== undefined
            ? BigInt(process.env.END_BLOCK)
            : undefined,
    outputFilePath:
        process.env.OUTPUT_FILE || 'balancer/eoaPoolCreation.results.json',
    pageSize:
        process.env.PAGE_SIZE !== undefined
            ? Number(process.env.PAGE_SIZE)
            : 1000,
    maxTxs:
        process.env.MAX_TXS !== undefined
            ? Number(process.env.MAX_TXS)
            : undefined,
    receiptConcurrency:
        process.env.RECEIPT_CONCURRENCY !== undefined
            ? Number(process.env.RECEIPT_CONCURRENCY)
            : 2,
    maxRetries:
        process.env.MAX_RETRIES !== undefined
            ? Number(process.env.MAX_RETRIES)
            : 8,
    retryDelayMs:
        process.env.RETRY_DELAY_MS !== undefined
            ? Number(process.env.RETRY_DELAY_MS)
            : 2000,
};

const poolCreatedEvent = parseAbiItem(
    'event PoolCreated(address indexed pool)'
);

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name} environment variable`);
    }
    return value;
}

function assertValidConfig(config: RuntimeConfig): NetworkConfig {
    const networkConfig = NETWORK_CONFIG[config.network];
    if (!networkConfig) {
        throw new Error(`Unsupported NETWORK: ${config.network}`);
    }
    if (DATA_SOURCE === 'explorer') {
        getRequiredEnv(networkConfig.explorerApiKeyEnvVar);
    }
    getRequiredEnv(networkConfig.rpcUrlEnvVar);
    if (!Number.isInteger(config.pageSize) || config.pageSize < 1) {
        throw new Error(`PAGE_SIZE must be a positive integer`);
    }
    if (
        !Number.isInteger(config.receiptConcurrency) ||
        config.receiptConcurrency < 1
    ) {
        throw new Error(`RECEIPT_CONCURRENCY must be a positive integer`);
    }
    if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0) {
        throw new Error(`MAX_RETRIES must be a non-negative integer`);
    }
    if (!Number.isFinite(config.retryDelayMs) || config.retryDelayMs < 0) {
        throw new Error(`RETRY_DELAY_MS must be a non-negative number`);
    }
    if (
        config.startBlock !== undefined &&
        config.endBlock !== undefined &&
        config.endBlock < config.startBlock
    ) {
        throw new Error(`END_BLOCK cannot be less than START_BLOCK`);
    }
    return networkConfig;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries<T>(
    action: () => Promise<T>,
    maxRetries: number,
    baseDelayMs: number
): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            return await action();
        } catch (error) {
            lastError = error;
            if (attempt === maxRetries) {
                break;
            }
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
    throw lastError;
}

function toAddress(value: string): Address {
    return getAddress(value);
}

function parseBlockNumber(value: string): bigint {
    if (!/^\d+$/.test(value)) {
        throw new Error(`Invalid blockNumber value: ${value}`);
    }
    return BigInt(value);
}

function parseTimestamp(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid timeStamp value: ${value}`);
    }
    return parsed;
}

function isNoDataExplorerResponse<T>(response: ArbiscanResponse<T>): boolean {
    return (
        response.status === '0' &&
        typeof response.result === 'string' &&
        response.result.toLowerCase().includes('no transactions')
    );
}

interface BlockscoutV2Tx {
    hash: Hex;
    from: { hash: Address };
    block_number: number;
    timestamp: string;
}

interface BlockscoutV2NextPageParams {
    block_number: number;
    index: number;
    items_count: number;
}

interface BlockscoutV2Response {
    items: BlockscoutV2Tx[];
    next_page_params: BlockscoutV2NextPageParams | null;
}

async function fetchEoaTransactionsBlockscout(
    config: RuntimeConfig,
    networkConfig: NetworkConfig
): Promise<EoaTx[]> {
    const txs = new Map<Hex, EoaTx>();
    let nextPageParams: BlockscoutV2NextPageParams | null = null;
    let pageNum = 1;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({ filter: 'from' });
        if (nextPageParams) {
            params.set('block_number', String(nextPageParams.block_number));
            params.set('index', String(nextPageParams.index));
            params.set('items_count', String(nextPageParams.items_count));
        } else if (config.endBlock !== undefined) {
            // Seed the cursor so Blockscout starts at or before endBlock
            // (results are returned newest-first).
            params.set('block_number', config.endBlock.toString());
            params.set('index', '0');
            params.set('items_count', '0');
        }

        const url = `${networkConfig.blockscoutApiBaseUrl}/v2/addresses/${
            config.eoa
        }/transactions?${params.toString()}`;

        const response = await withRetries(
            async () => {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(
                        `Blockscout request failed with status ${res.status}`
                    );
                }
                return res.json() as Promise<BlockscoutV2Response>;
            },
            config.maxRetries,
            config.retryDelayMs
        );

        const items = response.items ?? [];
        let reachedStartBlock = false;

        for (const tx of items) {
            if (!tx.hash || !tx.from?.hash) {
                continue;
            }
            // Client-side from-address guard in case the API filter is unreliable.
            if (getAddress(tx.from.hash) !== getAddress(config.eoa)) {
                continue;
            }
            const blockNum = BigInt(tx.block_number ?? 0);
            if (
                config.startBlock !== undefined &&
                blockNum < config.startBlock
            ) {
                reachedStartBlock = true;
                continue;
            }
            const tsSeconds = Math.floor(
                new Date(tx.timestamp).getTime() / 1000
            );
            txs.set(tx.hash, {
                hash: tx.hash,
                blockNumber: blockNum,
                timestamp: tsSeconds,
            });
        }

        console.log(
            `Fetched tx page ${pageNum} (${items.length} txs, ${txs.size} kept)`
        );

        // Stop if there are no more pages, no items, we've descended below
        // startBlock, or we've hit the optional transaction cap.
        if (
            !response.next_page_params ||
            items.length === 0 ||
            reachedStartBlock ||
            (config.maxTxs !== undefined && txs.size >= config.maxTxs)
        ) {
            hasMore = false;
        } else {
            nextPageParams = response.next_page_params;
        }
        pageNum += 1;
    }

    return Array.from(txs.values()).sort((a, b) =>
        a.blockNumber === b.blockNumber
            ? a.hash.localeCompare(b.hash)
            : a.blockNumber < b.blockNumber
            ? -1
            : 1
    );
}

function buildExplorerTxListUrl(
    config: RuntimeConfig,
    networkConfig: NetworkConfig,
    page: number
): string {
    const apiKey = getRequiredEnv(networkConfig.explorerApiKeyEnvVar);
    const params = new URLSearchParams({
        chainid: String(networkConfig.chainId),
        module: 'account',
        action: 'txlist',
        address: config.eoa,
        startblock: config.startBlock ? config.startBlock.toString() : '0',
        endblock: config.endBlock ? config.endBlock.toString() : '99999999',
        page: String(page),
        offset: String(config.pageSize),
        sort: 'asc',
        apikey: apiKey,
    });
    return `${networkConfig.explorerApiBaseUrl}?${params.toString()}`;
}

async function fetchEoaTransactionsExplorer(
    config: RuntimeConfig,
    networkConfig: NetworkConfig
): Promise<EoaTx[]> {
    const txs = new Map<Hex, EoaTx>();
    let page = 1;
    let shouldContinue = true;

    while (shouldContinue) {
        const url = buildExplorerTxListUrl(config, networkConfig, page);

        const response = await withRetries(
            async () => {
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error(
                        `Explorer request failed with status ${res.status}`
                    );
                }
                const parsed: ArbiscanResponse<ArbiscanNormalTx[] | string> =
                    await res.json();
                return parsed;
            },
            config.maxRetries,
            config.retryDelayMs
        );

        if (isNoDataExplorerResponse(response)) {
            break;
        }

        if (response.status !== '1' || !Array.isArray(response.result)) {
            throw new Error(
                `Explorer error on page ${page}: ${response.message} (${String(
                    response.result
                )})`
            );
        }

        const pageItems = response.result as ArbiscanNormalTx[];
        if (pageItems.length === 0) {
            break;
        }

        for (const tx of pageItems) {
            if (toAddress(tx.from) !== config.eoa) {
                continue;
            }
            txs.set(tx.hash, {
                hash: tx.hash,
                blockNumber: parseBlockNumber(tx.blockNumber),
                timestamp: parseTimestamp(tx.timeStamp),
            });
        }

        console.log(
            `Fetched tx page ${page} (${pageItems.length} txs, ${txs.size} kept)`
        );

        if (pageItems.length < config.pageSize) {
            shouldContinue = false;
        }
        page += 1;
    }

    return Array.from(txs.values()).sort((a, b) =>
        a.blockNumber === b.blockNumber
            ? a.hash.localeCompare(b.hash)
            : a.blockNumber < b.blockNumber
            ? -1
            : 1
    );
}

async function fetchEoaTransactions(
    config: RuntimeConfig,
    networkConfig: NetworkConfig
): Promise<EoaTx[]> {
    if (DATA_SOURCE === 'blockscout') {
        return fetchEoaTransactionsBlockscout(config, networkConfig);
    }
    return fetchEoaTransactionsExplorer(config, networkConfig);
}

async function mapWithConcurrency<T, R>(
    items: T[],
    worker: (item: T) => Promise<R[]>,
    concurrency: number
): Promise<R[]> {
    const results: R[] = [];
    let currentIndex = 0;
    const workerCount = Math.min(Math.max(concurrency, 1), items.length || 1);

    async function runWorker(): Promise<void> {
        while (currentIndex < items.length) {
            const index = currentIndex;
            currentIndex += 1;
            const partial = await worker(items[index]);
            results.push(...partial);
        }
    }

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}

async function extractPoolCreatedEvents(
    txs: EoaTx[],
    config: RuntimeConfig,
    networkConfig: NetworkConfig
): Promise<PoolCreatedEventRecord[]> {
    const client = createPublicClient({
        chain: networkConfig.chain,
        transport: http(getRequiredEnv(networkConfig.rpcUrlEnvVar)),
    });

    const events = await mapWithConcurrency(
        txs,
        async (tx) => {
            const receipt = await withRetries(
                () => client.getTransactionReceipt({ hash: tx.hash }),
                config.maxRetries,
                config.retryDelayMs
            );

            const matched: PoolCreatedEventRecord[] = [];
            for (const log of receipt.logs) {
                try {
                    const typedLog = log as { topics?: readonly Hex[] };
                    const maybeTopics = typedLog.topics;
                    if (!maybeTopics || maybeTopics.length === 0) {
                        continue;
                    }
                    const decoded = decodeEventLog({
                        abi: [poolCreatedEvent],
                        data: log.data,
                        topics: [...maybeTopics] as [Hex, ...Hex[]],
                    }) as {
                        eventName: 'PoolCreated';
                        args: { pool?: Address };
                    };
                    if (decoded.eventName !== 'PoolCreated') {
                        continue;
                    }
                    const poolAddress = decoded.args.pool;
                    if (!poolAddress) {
                        continue;
                    }
                    matched.push({
                        network: config.network,
                        eoa: config.eoa,
                        txHash: tx.hash,
                        blockNumber: tx.blockNumber,
                        timestamp: tx.timestamp,
                        factoryAddress: getAddress(log.address),
                        poolAddress: getAddress(poolAddress),
                        logIndex: Number(log.logIndex ?? 0n),
                    });
                } catch (_error) {
                    continue;
                }
            }

            return matched;
        },
        config.receiptConcurrency
    );

    const deduped = new Map<string, PoolCreatedEventRecord>();
    for (const event of events) {
        const key = `${event.txHash}:${event.logIndex}`;
        deduped.set(key, event);
    }

    return Array.from(deduped.values()).sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber < b.blockNumber ? -1 : 1;
        }
        if (a.logIndex !== b.logIndex) {
            return a.logIndex - b.logIndex;
        }
        return a.txHash.localeCompare(b.txHash);
    });
}

function toIso(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toISOString();
}

function printSummary(events: PoolCreatedEventRecord[]): void {
    console.log('');
    console.log('EOA PoolCreated Discovery');
    console.log('------------------------');
    console.log(`Total PoolCreated events: ${events.length}`);
    const byFactory = new Map<string, number>();
    for (const event of events) {
        byFactory.set(
            event.factoryAddress,
            (byFactory.get(event.factoryAddress) || 0) + 1
        );
    }
    if (byFactory.size === 0) {
        console.log('No PoolCreated events found.');
        return;
    }
    console.log('Factory breakdown:');
    for (const [factory, count] of Array.from(byFactory.entries()).sort(
        (a, b) => b[1] - a[1]
    )) {
        console.log(`- ${factory}: ${count}`);
    }
    console.log('');
    for (const event of events) {
        console.log(
            [
                `block=${event.blockNumber.toString()}`,
                `time=${toIso(event.timestamp)}`,
                `tx=${event.txHash}`,
                `factory=${event.factoryAddress}`,
                `pool=${event.poolAddress}`,
            ].join(' ')
        );
    }
}

function writeJsonOutput(
    outputPath: string,
    events: PoolCreatedEventRecord[]
): void {
    const serializable = events.map((event) => ({
        ...event,
        blockNumber: event.blockNumber.toString(),
        timestampIso: toIso(event.timestamp),
    }));
    writeFileSync(outputPath, JSON.stringify(serializable, null, 2));
}

async function main(): Promise<void> {
    const start = Date.now();
    const networkConfig = assertValidConfig(runtimeConfig);

    console.log(`Network: ${runtimeConfig.network}`);
    console.log(`Data source: ${DATA_SOURCE}`);
    console.log(`EOA: ${runtimeConfig.eoa}`);
    console.log(
        `Block range: ${runtimeConfig.startBlock ?? '0'} -> ${
            runtimeConfig.endBlock ?? 'latest'
        }`
    );
    if (runtimeConfig.maxTxs !== undefined) {
        console.log(
            `[SAMPLING] Max txs capped at ${runtimeConfig.maxTxs} — results are incomplete`
        );
    }

    const txs = await fetchEoaTransactions(runtimeConfig, networkConfig);
    console.log(`Collected ${txs.length} EOA transactions`);

    const events = await extractPoolCreatedEvents(
        txs,
        runtimeConfig,
        networkConfig
    );
    printSummary(events);

    writeJsonOutput(runtimeConfig.outputFilePath, events);
    console.log(`\nWrote JSON output to ${runtimeConfig.outputFilePath}`);
    console.log(`Completed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
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
