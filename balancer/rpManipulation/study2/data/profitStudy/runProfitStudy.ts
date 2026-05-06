// npx ts-node balancer/rpManipulation/study2/data/profitStudy/runProfitStudy.ts
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { analyzePool } from './aggregatePool';
import {
    buildProfitStudyConfig,
    PROFIT_STUDY,
    type ProfitStudyConfig,
    type ProfitStudyInputConfig,
} from './config';
import { fetchAllPoolEventsForPool } from './fetchPoolEventsForPool';
import { fetchHistoricalPricesMap } from './fetchTokenHistoricalPrices';
import { filterAddRemoveEventsForSender } from './filterAddRemoveEvents';
import type {
    AddRemoveEvent,
    PoolExcludedResult,
    PoolIncludedResult,
    PoolListEntry,
    ValueUsdWarning,
} from './types';

function loadConfig(): ProfitStudyConfig {
    const raw = readFileSync(PROFIT_STUDY.configJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as ProfitStudyInputConfig;
    return buildProfitStudyConfig(parsed);
}

function tokenKey(address: string): string {
    return address.trim().toLowerCase();
}

function collectUniqueTokenAddresses(
    eventsByPool: Map<string, { events: AddRemoveEvent[] }>
): string[] {
    const set = new Set<string>();
    for (const { events } of eventsByPool.values()) {
        for (const ev of events) {
            for (const t of ev.tokens) {
                set.add(tokenKey(t.address));
            }
        }
    }
    return [...set];
}

function buildMarkdown(params: {
    config: ProfitStudyConfig;
    included: PoolIncludedResult[];
    excluded: PoolExcludedResult[];
    warnings: ValueUsdWarning[];
}): string {
    const { config, included, excluded, warnings } = params;
    const lines: string[] = [];
    lines.push('# Profit study — configured pools (sender-filtered)');
    lines.push('');
    lines.push('## Parameters');
    lines.push(
        `- Network: \`${config.network}\``,
        `- Target wallet: \`${config.wallet}\``,
        `- Pool count: ${config.poolIds.length}`,
        `- valueUSD warning threshold: ${config.valueUsdWarningThresholdBps} bps`,
        '- Assumption: sender has exactly one ADD and one REMOVE per pool (single-leg round trip).'
    );
    lines.push('');
    lines.push('## Effective run config');
    lines.push('```json');
    lines.push(JSON.stringify(config, null, 2));
    lines.push('```');
    lines.push('');
    lines.push('## Note');
    lines.push(config.gasOmissionNote);
    lines.push('');
    lines.push('## Included pools');
    lines.push('');
    lines.push(
        '| Pool (short) | Adds | Removes | Capital in (USD) | Capital out (USD) | PnL (USD) | HODL at exit (USD) | LP - HODL (USD) | LP - HODL (%) |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
    );
    for (const row of included) {
        const short = `${row.poolId.slice(0, 10)}…${row.poolId.slice(-6)}`;
        lines.push(
            `| \`${short}\` | ${row.addEventCount} | ${row.removeEventCount} | ${row.capitalInUsd} | ${row.capitalOutUsd} | ${row.pnlUsd} | ${row.hodlBenchmark.hodlValueUsdAtExit} | ${row.hodlBenchmark.lpMinusHodlUsd} | ${row.hodlBenchmark.lpMinusHodlPct} |`
        );
    }
    lines.push('');
    if (included.length > 0) {
        lines.push('## Event token prices (as-of each event timestamp)');
        lines.push('');
        for (const row of included) {
            lines.push(`### Pool \`${row.poolId}\``);
            for (const ev of row.events) {
                lines.push(
                    `- ${ev.type} event \`${ev.eventId.slice(0, 18)}…\` at ts ${ev.timestamp} (tx \`${ev.tx}\`)`
                );
                for (const tv of ev.tokenValuations) {
                    lines.push(
                        `  - token \`${tv.address}\`: priceTimestamp=${tv.priceTimestamp}, matchedPricePointTimestamp=${tv.matchedPricePointTimestamp}, amount=${tv.amount}, priceUsdAtEvent=${tv.priceUsdAtEvent}, usdContribution=${tv.usdContribution}`
                    );
                }
            }
            lines.push('');
        }
    }
    if (warnings.length > 0) {
        lines.push('## valueUSD deviation warnings');
        lines.push('');
        for (const w of warnings) {
            lines.push(
                `- Pool \`${w.poolId.slice(0, 10)}…\` event \`${w.eventId.slice(0, 18)}…\` tx \`${w.tx}\`: deviation ${w.deviationBps.toFixed(2)} bps (reconstructed ${w.reconstructedUsd}, API ${w.valueUsdApi})`
            );
        }
        lines.push('');
    }
    if (excluded.length > 0) {
        lines.push('## Excluded pools');
        lines.push('');
        for (const e of excluded) {
            lines.push(
                `- \`${e.poolId}\` (${e.poolAddress}): **${e.reason}** — ${e.detail ?? ''}`
            );
        }
        lines.push('');
    }
    return lines.join('\n');
}

async function main(): Promise<void> {
    const config = loadConfig();
    const entries: PoolListEntry[] = config.poolIds.map((poolId) => ({
        poolId,
        poolAddress: poolId,
        protocolVersion: 0,
    }));

    const eventsByPool = new Map<
        string,
        { entry: PoolListEntry; events: AddRemoveEvent[] }
    >();

    console.log(
        `Loaded ${entries.length} configured pool IDs for ${config.network}.`
    );

    for (const entry of entries) {
        console.log(`Fetching poolEvents for ${entry.poolId.slice(0, 12)}…`);
        const raw = await fetchAllPoolEventsForPool({
            config,
            poolId: entry.poolId,
        });
        const filtered = filterAddRemoveEventsForSender({
            rows: raw,
            targetSender: config.wallet,
            poolId: entry.poolId,
        });
        eventsByPool.set(entry.poolId, { entry, events: filtered });
        console.log(
            `  -> ${filtered.length} ADD/REMOVE from sender (of ${raw.length} raw rows)`
        );
    }

    const uniqueTokens = collectUniqueTokenAddresses(eventsByPool);
    console.log(
        `Fetching historical prices for ${uniqueTokens.length} unique tokens...`
    );
    const priceMap = await fetchHistoricalPricesMap({
        config,
        uniqueAddresses: uniqueTokens,
    });

    const included: PoolIncludedResult[] = [];
    const excluded: PoolExcludedResult[] = [];
    const allWarnings: ValueUsdWarning[] = [];

    for (const { entry, events } of eventsByPool.values()) {
        const analysis = analyzePool({
            entry,
            events,
            priceMap,
            warningThresholdBps: config.valueUsdWarningThresholdBps,
        });

        if (analysis.kind === 'excluded') {
            excluded.push(analysis.excluded);
            console.error(
                `[EXCLUDED] pool ${entry.poolId}: ${analysis.excluded.reason} - ${analysis.excluded.detail}`
            );
            continue;
        }

        included.push(analysis.result);
        for (const w of analysis.warnings) {
            allWarnings.push(w);
            console.warn(
                `[valueUSD] pool ${w.poolId.slice(0, 10)}... event ${w.eventId.slice(0, 12)}... deviation ${w.deviationBps.toFixed(1)} bps (> ${config.valueUsdWarningThresholdBps})`
            );
        }
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        config,
        gasNote: config.gasOmissionNote,
        includedPools: included,
        excludedPools: excluded,
        warnings: allWarnings,
    };

    mkdirSync(dirname(config.outputJsonPath), { recursive: true });
    writeFileSync(config.outputJsonPath, JSON.stringify(payload, null, 2), 'utf8');
    writeFileSync(
        config.outputMarkdownPath,
        buildMarkdown({ config, included, excluded, warnings: allWarnings }),
        'utf8'
    );

    console.log(`Done. JSON: ${config.outputJsonPath}`);
    console.log(`Markdown: ${config.outputMarkdownPath}`);
    console.log(
        `Included: ${included.length}, excluded: ${excluded.length}, valueUSD warnings: ${allWarnings.length}`
    );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
