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
