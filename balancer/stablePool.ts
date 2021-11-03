require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { getProvider, getWallet } from '../constants/network';

import stablePoolAbi from '../abi/StablePool.json';

async function queryAmpFactor(poolAddress: string, provider = getProvider()) {
    const poolContract = new Contract(poolAddress, stablePoolAbi, provider);

    // value, isUpdating, precision
    const ampFactor = await poolContract.getAmplificationParameter();

    console.log(ampFactor.toString());
}

async function updateAmpFactor(
    poolAddress: string,
    rawEndValue: string,
    endTime: string,
    provider = getProvider(),
    wallet = getWallet(provider)
) {
    console.log(wallet.address);
    const poolContract = new Contract(poolAddress, stablePoolAbi, provider);
    /*
    Begins changing the amplification parameter to `rawEndValue` over time. The value will change linearly until
    `endTime` is reached, when it will be`rawEndValue`.
    Daily Rate must be < 2
    DailyRate = (86400*CurrentValue)/(EndValue*(endTime-BlockTime))
    */
    const tx = await poolContract
        .connect(wallet)
        .startAmplificationParameterUpdate(rawEndValue, endTime, {
            gasPrice: '20000000000',
            gasLimit: '5000000',
        });
    console.log(tx);
    await tx.wait();
    console.log('Update Started');
}

// ts-node ./balancer/stablePool.ts
queryAmpFactor('0x6b15a01b5d46a5321b627bd7deef1af57bc62907');
// updateAmpFactor('0x6b15a01b5d46a5321b627bd7deef1af57bc62907', '5', '1637280571');
