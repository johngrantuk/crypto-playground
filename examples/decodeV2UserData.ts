// npx ts-node ./examples/decodeV2UserData.ts
import { defaultAbiCoder } from '@ethersproject/abi';

function decode() {
    const decoded = defaultAbiCoder.decode(
        ['uint256', 'uint256'],
        '0x00000000000000000000000000000000000000000000000000000000000000ff0000000000000000000000000000000000000000000000011ef6500dc7294fda',
    );
    console.log(decoded[0].toString());
    console.log(decoded[1].toString());
}

decode();
