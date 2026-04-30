import { PROFIT_STUDY_CONFIG } from './config';
import type { JoinExitData } from './fetchJoinExitData';
import type { PriceSelection } from './fetchUniswapPriceAtBlock';

export type ProfitabilityResult = {
    inputs: {
        poolId: `0x${string}`;
        lpAddress: `0x${string}`;
        joinTxHash: `0x${string}`;
        exitTxHash: `0x${string}`;
        joinBlock: string;
        exitBlock: string;
        includeGasCosts: boolean;
        usdcUsdPrice: number;
    };
    tokenFlows: {
        join: { weth: string; usdc: string };
        exit: { weth: string; usdc: string };
    };
    prices: {
        join: PriceSelection;
        exit: PriceSelection;
    };
    valuation: {
        joinValueUsd: number;
        exitValueUsd: number;
        gasCostJoinUsd: number;
        gasCostExitUsd: number;
        totalGasCostUsd: number;
    };
    profitability: {
        realizedPnlUsd: number;
        realizedReturnPct: number;
    };
    hodlBenchmark: {
        hodlValueUsdAtExit: number;
        lpMinusHodlUsd: number;
        lpMinusHodlPct: number;
    };
    validations: {
        bptRoundTripMatches: boolean;
        bptJoin: string;
        bptExit: string;
    };
};

const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;

function rawToFloat(raw: bigint, decimals: number): number {
    return Number(raw) / 10 ** decimals;
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function pct(numerator: number, denominator: number): number {
    if (denominator === 0) {
        return Number.NaN;
    }
    return (numerator / denominator) * 100;
}

export function calcProfitability(params: {
    joinExit: JoinExitData;
    joinPrice: PriceSelection;
    exitPrice: PriceSelection;
}): ProfitabilityResult {
    const { joinExit, joinPrice, exitPrice } = params;

    const joinWeth = rawToFloat(joinExit.join.wethAmount, WETH_DECIMALS);
    const joinUsdc = rawToFloat(joinExit.join.usdcAmount, USDC_DECIMALS);
    const exitWeth = rawToFloat(joinExit.exit.wethAmount, WETH_DECIMALS);
    const exitUsdc = rawToFloat(joinExit.exit.usdcAmount, USDC_DECIMALS);

    const joinValueUsd =
        joinWeth * joinPrice.priceUsdPerWeth +
        joinUsdc * PROFIT_STUDY_CONFIG.usdcUsdPrice;
    const exitValueUsd =
        exitWeth * exitPrice.priceUsdPerWeth +
        exitUsdc * PROFIT_STUDY_CONFIG.usdcUsdPrice;

    const gasJoinEth = rawToFloat(joinExit.join.gasCostEth, 18);
    const gasExitEth = rawToFloat(joinExit.exit.gasCostEth, 18);
    const gasCostJoinUsd = gasJoinEth * joinPrice.priceUsdPerWeth;
    const gasCostExitUsd = gasExitEth * exitPrice.priceUsdPerWeth;
    const totalGasCostUsd = gasCostJoinUsd + gasCostExitUsd;

    const grossPnl = exitValueUsd - joinValueUsd;
    const netPnl = PROFIT_STUDY_CONFIG.includeGasCosts
        ? grossPnl - totalGasCostUsd
        : grossPnl;

    const hodlValueUsdAtExit =
        joinWeth * exitPrice.priceUsdPerWeth +
        joinUsdc * PROFIT_STUDY_CONFIG.usdcUsdPrice;
    const lpMinusHodlUsd = exitValueUsd - hodlValueUsdAtExit;

    const bptRoundTripMatches =
        joinExit.bptSupplyDeltaJoin === joinExit.bptBurnDeltaExit;

    return {
        inputs: {
            poolId: PROFIT_STUDY_CONFIG.poolId,
            lpAddress: PROFIT_STUDY_CONFIG.lpAddress,
            joinTxHash: PROFIT_STUDY_CONFIG.joinTxHash,
            exitTxHash: PROFIT_STUDY_CONFIG.exitTxHash,
            joinBlock: joinExit.join.blockNumber.toString(),
            exitBlock: joinExit.exit.blockNumber.toString(),
            includeGasCosts: PROFIT_STUDY_CONFIG.includeGasCosts,
            usdcUsdPrice: PROFIT_STUDY_CONFIG.usdcUsdPrice,
        },
        tokenFlows: {
            join: { weth: String(joinWeth), usdc: String(joinUsdc) },
            exit: { weth: String(exitWeth), usdc: String(exitUsdc) },
        },
        prices: {
            join: joinPrice,
            exit: exitPrice,
        },
        valuation: {
            joinValueUsd: round(joinValueUsd),
            exitValueUsd: round(exitValueUsd),
            gasCostJoinUsd: round(gasCostJoinUsd),
            gasCostExitUsd: round(gasCostExitUsd),
            totalGasCostUsd: round(totalGasCostUsd),
        },
        profitability: {
            realizedPnlUsd: round(netPnl),
            realizedReturnPct: round(pct(netPnl, joinValueUsd)),
        },
        hodlBenchmark: {
            hodlValueUsdAtExit: round(hodlValueUsdAtExit),
            lpMinusHodlUsd: round(lpMinusHodlUsd),
            lpMinusHodlPct: round(pct(lpMinusHodlUsd, hodlValueUsdAtExit)),
        },
        validations: {
            bptRoundTripMatches,
            bptJoin: joinExit.bptSupplyDeltaJoin.toString(),
            bptExit: joinExit.bptBurnDeltaExit.toString(),
        },
    };
}
