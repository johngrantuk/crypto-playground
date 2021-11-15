import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
    ARBITRUM = 42161,
}

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.KOVAN]: `https://kovan.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://rpc-mainnet.matic.network`,
    [Network.ARBITRUM]: `https://arb1.arbitrum.io/rpc`,
};

export function getProvider(networkId: number): JsonRpcProvider {
    return new JsonRpcProvider(PROVIDER_URLS[networkId]);
}

export function getWallet(provider: JsonRpcProvider): Wallet {
    return new Wallet(process.env.TRADER_KEY, provider);
}
