export const balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

export interface TestToken {
    address: string;
    decimals: number;
}

// Kovan version
export const STABAL3PHANTOM: TestToken = {
    address: '0x8fd162f338b770f7e879030830cde9173367f301',
    decimals: 18,
};

// Kovan version
export const AAVE_USDT: TestToken = {
    address: '0x13512979ade267ab5100878e2e0f485b568328a4',
    decimals: 6,
};

// Kovan version
export const AAVE_USDC: TestToken = {
    address: '0xe22da380ee6b445bb8273c81944adeb6e8450422',
    decimals: 6,
};

// Kovan version
export const AAVE_DAI: TestToken = {
    address: '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
    decimals: 18,
};