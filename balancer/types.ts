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