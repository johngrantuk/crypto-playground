// npx ts-node balancer/api/stableSurgeRisky/audit.ts
import * as fs from 'fs';
import * as path from 'path';
import { discoverActiveChains } from './chains';
import { evaluatePool } from './evaluatePool';
import { enrichRiskyPoolOwners, fetchAllStablePools } from './graphql';
import { AuditOutput, AuditPoolRow } from './types';

const OUTPUT_DIR = path.join(__dirname);
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'output.json');
const OUTPUT_TMP = path.join(OUTPUT_DIR, 'output.json.tmp');

function parseTvl(value: string | null | undefined): number {
    if (value == null) {
        return -1;
    }
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : -1;
}

function sortPools(rows: AuditPoolRow[]): AuditPoolRow[] {
    return [...rows].sort((a, b) => {
        if (a.chainId !== b.chainId) {
            return a.chainId - b.chainId;
        }
        const tvlDiff =
            parseTvl(b.metrics.totalLiquidity) -
            parseTvl(a.metrics.totalLiquidity);
        if (tvlDiff !== 0) {
            return tvlDiff;
        }
        return a.pool.localeCompare(b.pool);
    });
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function formatOwner(owner: string | null): string {
    if (owner == null) {
        return 'n/a';
    }
    if (owner === ZERO_ADDRESS) {
        return 'none (zero address)';
    }
    return owner;
}

function printSummary(output: AuditOutput): void {
    const risky = output.pools.filter((p) => p.surge_excluded);

    console.log('');
    console.log('── Summary ──────────────────────────────────────');
    console.log(`  specVersion:  ${output.specVersion}`);
    console.log(`  evaluated:    ${output.totals.evaluated} pools`);
    console.log(`  risky:        ${output.totals.risky} pools`);
    console.log(`  activeChains: ${output.activeChains.join(', ')}`);
    console.log('');

    if (risky.length === 0) {
        console.log('No risky pools found.');
        return;
    }

    console.log(`── Risky pools (${risky.length}) ─────────────────────────`);
    console.log('');

    let lastChain: string | null = null;
    let indexInChain = 0;
    risky.forEach((row) => {
        if (row.chain !== lastChain) {
            if (lastChain != null) {
                console.log('');
            }
            console.log(`  ${row.chain}`);
            console.log('  ' + '─'.repeat(44));
            lastChain = row.chain;
            indexInChain = 0;
        }
        indexInChain += 1;
        const countInChain = risky.filter((r) => r.chain === row.chain).length;

        console.log(
            `  [${indexInChain}/${countInChain}] ${row.exclusion_path}`
        );
        console.log(`    pool:      ${row.pool}`);
        console.log(`    owner:     ${formatOwner(row.owner)}`);
        console.log(`    hook:      ${row.hookType ?? 'none'}`);
        console.log(
            `    tvl:       ${row.metrics.totalLiquidity ?? 'n/a'}`
        );
        console.log(
            `    surge:     max=${row.inputs.maxSurgeFeePercentage ?? 'null'}  threshold=${row.inputs.surgeThresholdPercentage ?? 'null'}  ratio=${row.inputs.feeSurgeRatio}`
        );
        console.log(`    url:       ${row.balancerUrl}`);
        console.log('');
    });
}

async function main(): Promise<void> {
    let phase = 'discoverActiveChains';
    try {
        console.log('Discovering active chains...');
        const activeChains = await discoverActiveChains();
        console.log(`Active chains (${activeChains.length}): ${activeChains.join(', ')}`);

        phase = 'fetchAllStablePools';
        console.log('Fetching stable pools...');
        const pools = await fetchAllStablePools(activeChains);
        console.log(`Fetched ${pools.length} pools`);

        phase = 'evaluate';
        let rows = sortPools(pools.map((p) => evaluatePool(p)));
        const riskyCount = rows.filter((r) => r.surge_excluded).length;

        phase = 'enrichRiskyPoolOwners';
        console.log(`Fetching owners for ${riskyCount} risky pools...`);
        rows = await enrichRiskyPoolOwners(rows);

        const output: AuditOutput = {
            specVersion: '2.0.0',
            activeChains,
            totals: { evaluated: rows.length, risky: riskyCount },
            pools: rows,
        };

        phase = 'write output.json';
        fs.writeFileSync(OUTPUT_TMP, JSON.stringify(output, null, 2) + '\n');
        fs.renameSync(OUTPUT_TMP, OUTPUT_PATH);

        printSummary(output);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Audit failed during ${phase}: ${message}`);
        if (fs.existsSync(OUTPUT_TMP)) {
            fs.unlinkSync(OUTPUT_TMP);
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
