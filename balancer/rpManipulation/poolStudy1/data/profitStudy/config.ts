export type Address = `0x${string}`;

export type ProfitStudyConfig = {
    baseRpcUrl: string;
    poolId: `0x${string}`;
    poolAddress: Address;
    vaultAddress: Address;
    lpAddress: Address;
    joinTxHash: `0x${string}`;
    exitTxHash: `0x${string}`;
    tokenWeth: Address;
    tokenUsdc: Address;
    uniswapFactory: Address;
    uniswapFee: number;
    twapWindowSeconds: number;
    spotTwapDeviationThresholdBps: number;
    usdcUsdPrice: number;
    includeGasCosts: boolean;
    outputJsonPath: string;
    outputMarkdownPath: string;
};

const baseRpcUrl = process.env.BASE_RPC_URL;
if (!baseRpcUrl) {
    throw new Error('Missing BASE_RPC_URL in environment (.env).');
}

export const PROFIT_STUDY_CONFIG: ProfitStudyConfig = {
    baseRpcUrl,
    poolId: '0x10bdbb4fe8dfd348d44397eedabb737df68bc9a0000200000000000000000248',
    poolAddress: '0x10bdbb4fe8dfd348d44397eedabb737df68bc9a0',
    vaultAddress: '0xba12222222228d8ba445958a75a0704d566bf2c8',
    lpAddress: '0x91906be1391d2fc7d01a7a6757c69daaefd2c257',
    joinTxHash:
        '0xe93dc163fe50bf7d0c89c0fbe53c448150f3b4849d21abc0f8445faa61c10848',
    exitTxHash:
        '0x2ab83b7c31810138788d11d4be5adacbe7e9e00e78ab9b73f556d1ad0fa87ce3',
    tokenWeth: '0x4200000000000000000000000000000000000006',
    tokenUsdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    uniswapFactory: '0x33128a8fc17869897dce68ed026d694621f6fdfd',
    uniswapFee: 500,
    twapWindowSeconds: 600,
    spotTwapDeviationThresholdBps: 150,
    usdcUsdPrice: 1,
    includeGasCosts: false,
    outputJsonPath:
        'balancer/rpManipulation/poolStudy1/data/profitStudy/profitStudy.result.json',
    outputMarkdownPath:
        'balancer/rpManipulation/poolStudy1/data/profitStudy/profitStudy.md',
};
