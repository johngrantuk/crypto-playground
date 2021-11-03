require('dotenv').config();
import { Contract } from '@ethersproject/contracts';
import { getProvider, getWallet } from '../constants/network';
import { MaxUint256 } from '@ethersproject/constants';

import ERC20Abi from '../abi/ERC20.json';

export async function tokensApprove(tokens: string[], addressToApprove: string, amountToApprove: string = MaxUint256.toString(), provider=getProvider(), wallet=getWallet(provider)) {
    
    for(const token of tokens) {
        const tokenContract = new Contract(token, ERC20Abi, provider);
        const allowance = await tokenContract.allowance(wallet.address, addressToApprove);
        if(allowance.lt(amountToApprove)){
            console.log(`Approving: ${token} ${addressToApprove}...`);
            const tx = await tokenContract.connect(wallet).approve(addressToApprove, MaxUint256);
            await tx.wait();
            console.log(`Approved: ${tx.hash}`);
        } else {
            console.log(`Already has allowance: ${token} ${addressToApprove} ${allowance.toString()}`);
        }
    }
}

// ts-node ./helpers/helpers.ts
// tokensApprove(['0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7'], `0xBA12222222228d8Ba445958a75a0704d566BF2C8`);