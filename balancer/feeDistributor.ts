require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import { PROVIDER_URLS, Network } from '../constants/network';

import feeDistributorAbi from '../abi/feeDistributor.json';

export async function getRate(feeDistributorAddress: string): Promise<string> {
    const networkId = Network.MAINNET;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    const feeDistributorContract = new Contract(
        feeDistributorAddress,
        feeDistributorAbi,
        provider
    );

    const userAddr = '';
    const tokens = [
        '0x7B50775383d3D6f0215A8F290f2C9e2eEBBEceb2',
        '0xba100000625a3754423978a60c9317c58a424e3D',
    ];
    const claim = await feeDistributorContract.callStatic.claimTokens(
        userAddr,
        tokens
    );

    console.log(claim.toString());
    return claim.toString();
}

// ts-node ./balancer/feeDistributor.ts
getRate('0x26743984e3357eFC59f2fd6C1aFDC310335a61c9');
