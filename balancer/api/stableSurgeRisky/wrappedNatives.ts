/** Canonical wrapped-native address per chainId (lowercase). SPEC §3.4 */
export const wrappedNativeByChain = new Map<number, string>([
    [1, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
    [42161, '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'],
    [43114, '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'],
    [8453, '0x4200000000000000000000000000000000000006'],
    [999, '0x5555555555555555555555555555555555555555'],
    [146, '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38'],
]);
