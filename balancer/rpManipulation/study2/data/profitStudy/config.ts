import { join } from 'path';

const repoRoot = join(__dirname, '../../../../../');

export const SUPPORTED_NETWORKS = [
    'BASE',
    'MAINNET',
    'ARBITRUM',
    'POLYGON',
] as const;

export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];

export type ProfitStudyInputConfig = {
    network: string;
    wallet: string;
    poolIds: string[];
};

export type ProfitStudyConfig = {
    apiEndpoint: string;
    network: SupportedNetwork;
    wallet: string;
    poolIds: string[];
    poolEventsPageSize: number;
    historicalPricesBatchSize: number;
    valueUsdWarningThresholdBps: number;
    requestDelayMs: number;
    maxRequestRetries: number;
    retryBaseDelayMs: number;
    retryMaxDelayMs: number;
    outputJsonPath: string;
    outputMarkdownPath: string;
    gasOmissionNote: string;
};

export const PROFIT_STUDY = {
    configJsonPath: join(
        repoRoot,
        'balancer/rpManipulation/study2/data/profitStudy/profitStudy.config.json'
    ),
    outputJsonPath: join(
        repoRoot,
        'balancer/rpManipulation/study2/data/profitStudy/profitStudy.result.json'
    ),
    outputMarkdownPath: join(
        repoRoot,
        'balancer/rpManipulation/study2/data/profitStudy/profitStudy.md'
    ),
    apiEndpoint: 'https://api-v3.balancer.fi/',
    poolEventsPageSize: 500,
    historicalPricesBatchSize: 12,
    valueUsdWarningThresholdBps: 200,
    requestDelayMs: 80,
    maxRequestRetries: 6,
    retryBaseDelayMs: 1000,
    retryMaxDelayMs: 60000,
    gasOmissionNote:
        'Gas costs are omitted and are not subtracted from PnL values in this report.',
} as const;

function normalizeAddress(a: string): string {
    return a.trim().toLowerCase();
}

function normalizeNetwork(value: string): SupportedNetwork {
    const normalized = value.trim().toUpperCase();
    if ((SUPPORTED_NETWORKS as readonly string[]).includes(normalized)) {
        return normalized as SupportedNetwork;
    }
    throw new Error(
        `Unsupported network "${value}". Supported: ${SUPPORTED_NETWORKS.join(', ')}`
    );
}

export function buildProfitStudyConfig(
    input: ProfitStudyInputConfig
): ProfitStudyConfig {
    if (!Array.isArray(input.poolIds) || input.poolIds.length === 0) {
        throw new Error('Config "poolIds" must be a non-empty array.');
    }

    const normalizedPoolIds = [...new Set(input.poolIds.map(normalizeAddress))];
    const normalizedWallet = normalizeAddress(input.wallet);
    if (!normalizedWallet.startsWith('0x')) {
        throw new Error(`Config "wallet" must be a hex address, got: ${input.wallet}`);
    }

    return {
        apiEndpoint: PROFIT_STUDY.apiEndpoint,
        network: normalizeNetwork(input.network),
        wallet: normalizedWallet,
        poolIds: normalizedPoolIds,
        poolEventsPageSize: PROFIT_STUDY.poolEventsPageSize,
        historicalPricesBatchSize: PROFIT_STUDY.historicalPricesBatchSize,
        valueUsdWarningThresholdBps: PROFIT_STUDY.valueUsdWarningThresholdBps,
        requestDelayMs: PROFIT_STUDY.requestDelayMs,
        maxRequestRetries: PROFIT_STUDY.maxRequestRetries,
        retryBaseDelayMs: PROFIT_STUDY.retryBaseDelayMs,
        retryMaxDelayMs: PROFIT_STUDY.retryMaxDelayMs,
        outputJsonPath: PROFIT_STUDY.outputJsonPath,
        outputMarkdownPath: PROFIT_STUDY.outputMarkdownPath,
        gasOmissionNote: PROFIT_STUDY.gasOmissionNote,
    };
}
