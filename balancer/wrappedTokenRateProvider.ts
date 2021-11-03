require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';

import { PROVIDER_URLS, Network } from '../constants/network';

export async function getRate(rateProviderAddress: string): Promise<string> {
    const networkId = Network.KOVAN;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const rateProviderContract = new Contract(
        rateProviderAddress,
        ['function getRate() external view returns (uint256)'],
        provider
    );

    const rate = await rateProviderContract.getRate();

    console.log(rate.toString());
    return rate.toString();
}

// ts-node ./balancer/wrappedTokenRateProvider.ts
// getRate('0x26575A44755E0aaa969FDda1E4291Df22C5624Ea'); // Kovan aDAI
