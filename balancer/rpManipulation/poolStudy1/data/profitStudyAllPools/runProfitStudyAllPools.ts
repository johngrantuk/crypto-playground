// npx ts-node balancer/rpManipulation/poolStudy1/data/profitStudyAllPools/runProfitStudyAllPools.ts
import 'dotenv/config';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { PROFIT_STUDY_ALL_POOLS } from './config';
import type {
    AddRemoveEvent,
    PoolExcludedResult,
    PoolIncludedResult,
    PoolListEntry,
    ValueUsdWarning,
} from './types';
import { fetchAllPoolEventsForPool } from './fetchPoolEventsForPool';
import { filterAddRemoveEventsForSender } from './filterAddRemoveEvents';
import { fetchHistoricalPricesMap } from './fetchTokenHistoricalPrices';
import { analyzePool } from './aggregatePool';

function loadPools(): PoolListEntry[] {
    const raw = readFileSync(PROFIT_STUDY_ALL_POOLS.poolsJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
        throw new Error('Expected pools JSON to be an array');
    }
    return parsed as PoolListEntry[];
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
    included: PoolIncludedResult[];
    excluded: PoolExcludedResult[];
    warnings: ValueUsdWarning[];
}): string {
    const { included, excluded, warnings } = params;
    const lines: string[] = [];
    lines.push('# Profit study — all Base pools (sender-filtered)');
    lines.push('');
    lines.push('## Parameters');
    lines.push(
        `- Target sender: \`${PROFIT_STUDY_ALL_POOLS.targetSender}\``,
        `- valueUSD warning threshold: ${PROFIT_STUDY_ALL_POOLS.valueUsdWarningThresholdBps} bps`,
        '- Assumption: sender has exactly one ADD and one REMOVE per pool (single-leg round trip).'
    );
    lines.push('');
    lines.push('## Note');
    lines.push(PROFIT_STUDY_ALL_POOLS.gasOmissionNote);
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
    lines.push('## HODL benchmark note');
    lines.push('');
    lines.push(
        '- HODL benchmark values ADD token amounts at the REMOVE timestamp (single-leg assumption).'
    );
    lines.push('');
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
    const pools = loadPools();
    const targetSender = PROFIT_STUDY_ALL_POOLS.targetSender;
    const thresholdBps = PROFIT_STUDY_ALL_POOLS.valueUsdWarningThresholdBps;

    const eventsByPool = new Map<
        string,
        { entry: PoolListEntry; events: AddRemoveEvent[] }
    >();

    console.log(`Loaded ${pools.length} pools from JSON.`);

    for (const entry of pools) {
        console.log(`Fetching poolEvents for ${entry.poolId.slice(0, 12)}…`);
        const raw = await fetchAllPoolEventsForPool(entry.poolId);
        const filtered = filterAddRemoveEventsForSender({
            rows: raw,
            targetSender,
            poolId: entry.poolId,
        });
        eventsByPool.set(entry.poolId, { entry, events: filtered });
        console.log(
            `  → ${filtered.length} ADD/REMOVE from sender (of ${raw.length} raw rows)`
        );
    }

    const uniqueTokens = collectUniqueTokenAddresses(eventsByPool);
    console.log(
        `Fetching historical prices for ${uniqueTokens.length} unique tokens…`
    );
    const priceMap = await fetchHistoricalPricesMap(uniqueTokens);

    const included: PoolIncludedResult[] = [];
    const excluded: PoolExcludedResult[] = [];
    const allWarnings: ValueUsdWarning[] = [];

    for (const { entry, events } of eventsByPool.values()) {
        const analysis = analyzePool({
            entry,
            events,
            priceMap,
            warningThresholdBps: thresholdBps,
        });

        if (analysis.kind === 'excluded') {
            excluded.push(analysis.excluded);
            console.error(
                `[EXCLUDED] pool ${entry.poolId}: ${analysis.excluded.reason} — ${analysis.excluded.detail}`
            );
            continue;
        }

        included.push(analysis.result);
        for (const w of analysis.warnings) {
            allWarnings.push(w);
            console.warn(
                `[valueUSD] pool ${w.poolId.slice(0, 10)}… event ${w.eventId.slice(0, 12)}… deviation ${w.deviationBps.toFixed(1)} bps (> ${thresholdBps})`
            );
        }
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        config: {
            targetSender,
            warningThresholdBps: thresholdBps,
            poolsSource: PROFIT_STUDY_ALL_POOLS.poolsJsonPathRelative,
        },
        gasNote: PROFIT_STUDY_ALL_POOLS.gasOmissionNote,
        includedPools: included,
        excludedPools: excluded,
        warnings: allWarnings,
    };

    mkdirSync(dirname(PROFIT_STUDY_ALL_POOLS.outputJsonPath), {
        recursive: true,
    });
    writeFileSync(
        PROFIT_STUDY_ALL_POOLS.outputJsonPath,
        JSON.stringify(payload, null, 2),
        'utf8'
    );
    writeFileSync(
        PROFIT_STUDY_ALL_POOLS.outputMarkdownPath,
        buildMarkdown({ included, excluded, warnings: allWarnings }),
        'utf8'
    );

    console.log(`\nDone. JSON: ${PROFIT_STUDY_ALL_POOLS.outputJsonPath}`);
    console.log(`Markdown: ${PROFIT_STUDY_ALL_POOLS.outputMarkdownPath}`);
    console.log(
        `Included: ${included.length}, excluded: ${excluded.length}, valueUSD warnings: ${allWarnings.length}`
    );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
