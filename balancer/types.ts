import { BigNumberish } from '@ethersproject/bignumber';

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

export enum SwapTypes {
    SwapExactIn,
    SwapExactOut,
}

export type WeightedPoolInfo = {
    name: string;
    symbol: string;
    tokens: string[];
    weights: string[];
    swapFeePercentage: string;
    owner: string;
};

export interface Swap {
    poolId: string;
    assetInIndex: number;
    assetOutIndex: number;
    amount: BigNumberish;
    userData: string;
}
