// npx ts-node balancer/rpManipulation/poolStudy1/data/profitStudy/runProfitStudy.ts
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { PROFIT_STUDY_CONFIG } from './config';
import { fetchJoinExitData } from './fetchJoinExitData';
import { fetchUniswapPriceAtBlock } from './fetchUniswapPriceAtBlock';
import { calcProfitability } from './calcProfitability';

function jsonBigIntReplacer(_key: string, value: unknown): unknown {
    return typeof value === 'bigint' ? value.toString() : value;
}

function toMarkdown(result: ReturnType<typeof calcProfitability>): string {
    const lines: string[] = [];
    lines.push('# Pool Study 1 Profit Study');
    lines.push('');
    lines.push('## Inputs');
    lines.push(
        `- Pool ID: \`${result.inputs.poolId}\``,
        `- LP: \`${result.inputs.lpAddress}\``,
        `- Join tx: \`${result.inputs.joinTxHash}\` (block \`${result.inputs.joinBlock}\`)`,
        `- Exit tx: \`${result.inputs.exitTxHash}\` (block \`${result.inputs.exitBlock}\`)`
    );
    lines.push('');
    lines.push('## Token Flows');
    lines.push(
        `- Join: ${result.tokenFlows.join.weth} WETH + ${result.tokenFlows.join.usdc} USDC`
    );
    lines.push(
        `- Exit: ${result.tokenFlows.exit.weth} WETH + ${result.tokenFlows.exit.usdc} USDC`
    );
    lines.push('');
    lines.push('## Price Selection (Uniswap spot + TWAP guard)');
    lines.push(
        `- Join block: spot=${result.prices.join.spotUsdPerWeth.toFixed(
            6
        )}, twap=${result.prices.join.twapUsdPerWeth.toFixed(
            6
        )}, deviationBps=${result.prices.join.deviationBps.toFixed(
            2
        )}, selected=\`${result.prices.join.selectedSource}\``,
        `- Exit block: spot=${result.prices.exit.spotUsdPerWeth.toFixed(
            6
        )}, twap=${result.prices.exit.twapUsdPerWeth.toFixed(
            6
        )}, deviationBps=${result.prices.exit.deviationBps.toFixed(
            2
        )}, selected=\`${result.prices.exit.selectedSource}\``,
        `- Threshold: ${result.prices.join.thresholdBps} bps; TWAP window: ${result.prices.join.twapWindowSeconds} seconds`
    );
    lines.push('');
    lines.push('## Results');
    lines.push(
        `- Join value (USD): ${result.valuation.joinValueUsd.toFixed(2)}`
    );
    lines.push(
        `- Exit value (USD): ${result.valuation.exitValueUsd.toFixed(2)}`
    );
    lines.push(
        `- Realized PnL (USD): ${result.profitability.realizedPnlUsd.toFixed(
            2
        )}`
    );
    lines.push(
        `- Realized Return (%): ${result.profitability.realizedReturnPct.toFixed(
            2
        )}`
    );
    lines.push('');
    lines.push('## HODL Benchmark');
    lines.push(
        `- HODL value at exit (USD): ${result.hodlBenchmark.hodlValueUsdAtExit.toFixed(
            2
        )}`
    );
    lines.push(
        `- LP minus HODL (USD): ${result.hodlBenchmark.lpMinusHodlUsd.toFixed(
            2
        )}`
    );
    lines.push(
        `- LP minus HODL (%): ${result.hodlBenchmark.lpMinusHodlPct.toFixed(2)}`
    );
    lines.push('');
    lines.push('## Validation and Caveats');
    lines.push(
        `- BPT join/exit round-trip matches: ${
            result.validations.bptRoundTripMatches ? 'yes' : 'no'
        }`
    );
    lines.push(
        `- BPT join delta: ${result.validations.bptJoin}; BPT exit delta: ${result.validations.bptExit}`
    );
    lines.push(
        `- USDC is valued at ${result.inputs.usdcUsdPrice.toFixed(
            2
        )} USD by assumption.`
    );
    lines.push(
        `- Gas cost inclusion is ${
            result.inputs.includeGasCosts ? 'enabled' : 'disabled'
        }.`
    );
    return lines.join('\n');
}

async function main(): Promise<void> {
    const joinExit = await fetchJoinExitData();
    if (joinExit.join.blockNumber >= joinExit.exit.blockNumber) {
        throw new Error('Expected join block to be strictly before exit block');
    }

    const [joinPrice, exitPrice] = await Promise.all([
        fetchUniswapPriceAtBlock(joinExit.join.blockNumber),
        fetchUniswapPriceAtBlock(joinExit.exit.blockNumber),
    ]);

    const result = calcProfitability({
        joinExit,
        joinPrice,
        exitPrice,
    });

    if (!result.validations.bptRoundTripMatches) {
        throw new Error(
            'BPT join/exit amounts do not match expected round trip'
        );
    }

    mkdirSync(dirname(PROFIT_STUDY_CONFIG.outputJsonPath), { recursive: true });
    writeFileSync(
        PROFIT_STUDY_CONFIG.outputJsonPath,
        JSON.stringify(result, jsonBigIntReplacer, 2),
        'utf8'
    );
    writeFileSync(
        PROFIT_STUDY_CONFIG.outputMarkdownPath,
        toMarkdown(result),
        'utf8'
    );

    console.log('Profit study completed.');
    console.log(`JSON: ${PROFIT_STUDY_CONFIG.outputJsonPath}`);
    console.log(`Markdown: ${PROFIT_STUDY_CONFIG.outputMarkdownPath}`);
    console.log(
        `PnL=${result.profitability.realizedPnlUsd.toFixed(
            2
        )} USD, Return=${result.profitability.realizedReturnPct.toFixed(2)}%`
    );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
