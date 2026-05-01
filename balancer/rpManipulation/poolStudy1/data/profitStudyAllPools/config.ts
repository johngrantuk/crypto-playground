import { join } from 'path';

const repoRoot = join(__dirname, '../../../../../');

export const PROFIT_STUDY_ALL_POOLS = {
    apiEndpoint: 'https://api-v3.balancer.fi/',
    /** Pagination page size for poolEvents */
    poolEventsPageSize: 500,
    /** Max addresses per tokenGetHistoricalPrices request */
    historicalPricesBatchSize: 12,
    /** Warn when |reconstructed - valueUSD| / max(|valueUSD|, eps) exceeds this (basis points) */
    valueUsdWarningThresholdBps: 200,
    /** Optional delay (ms) between GraphQL calls to reduce rate limits */
    requestDelayMs: 80,
    /** Max retries for transient API failures (e.g. 429). */
    maxRequestRetries: 6,
    /** Initial backoff for retries; grows exponentially with cap. */
    retryBaseDelayMs: 1000,
    /** Maximum backoff delay between retries. */
    retryMaxDelayMs: 60000,
    targetSender: '0x91906be1391d2fc7d01a7a6757c69daaefd2c257',
    poolsJsonPathRelative:
        'balancer/rpManipulation/initialInvestigation/fetchPoolDynamicDataByNetwork.base.results.json',
    poolsJsonPath: join(
        repoRoot,
        'balancer/rpManipulation/initialInvestigation/fetchPoolDynamicDataByNetwork.base.results.json'
    ),
    outputJsonPath: join(
        repoRoot,
        'balancer/rpManipulation/poolStudy1/data/profitStudyAllPools/profitStudyAllPools.result.json'
    ),
    outputMarkdownPath: join(
        repoRoot,
        'balancer/rpManipulation/poolStudy1/data/profitStudyAllPools/profitStudyAllPools.md'
    ),
    gasOmissionNote:
        'Gas costs are omitted; Base fees are small relative to position size and were not subtracted from PnL.',
} as const;
