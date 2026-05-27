/** Tracker parity: nonNativesByChain. All addresses lowercase. SPEC §4 */
export const nonNativesByChain = new Map<number, Set<string>>([
    [
        42161,
        new Set([
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
            '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
            '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
            '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
        ]),
    ],
    [
        43114,
        new Set([
            '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
            '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664',
            '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
            '0xc7198437980c041c805a1edcba50c1ce5db95118',
            '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
            '0x152b9d0fdc40c096757f570a51e494bd4b943e50',
            '0x50b7545627a5162f82a992c33b87adc75187b218',
        ]),
    ],
    [
        8453,
        new Set([
            '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
            '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
            '0x0555e30da8f98308edb960aa94c0db47230d2b9c',
        ]),
    ],
    [
        1,
        new Set([
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0xdac17f958d2ee523a2206206994597c13d831ec7',
        ]),
    ],
    [
        999,
        new Set([
            '0xb88339cb7199b77e23db6e890353e22632ba630f',
            '0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb',
            '0x111111a1a0667d36bd57c0a9f569b98057111111',
            '0xbe6727b535545c67d5caa73dea54865b92cf7907',
        ]),
    ],
    [
        146,
        new Set(['0x29219dd400f2bf60e5a23d13be72b486d4038894']),
    ],
]);
