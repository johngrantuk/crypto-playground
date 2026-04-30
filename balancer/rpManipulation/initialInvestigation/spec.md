Chains: ARBITRUM, BASE

EOA: 0x91906bE1391D2fC7D01A7A6757c69dAaefd2C257

Factory Address: 0xdCA5f1F0d7994A32BC511e7dbA0259946653Eaf6

PoolCreated (index_topic_1 address pool)
TokensRegistered (index_topic_1 bytes32 poolId, address[] tokens, address[] assetManagers)

Ok, lets go with the arbiscan and viem approach. 
The script should be easy to configure with different networks and factory addresses.
Location for script: ./balancer/eoaPoolCreation.ts

Arbitrum:
Up to: 456836332, Apr-27-2026 09:07:48 AM
Total PoolCreated events: 33
Factory breakdown:
- 0xdCA5f1F0d7994A32BC511e7dbA0259946653Eaf6: 30 (GyroECLP)
- 0x8A8B9f35765899B3a0291700141470D79EA2eA88: 3 (StableSurge)

Base:
Total PoolCreated events: 273
Factory breakdown:
- 0x15e86Be6084C6A5a8c17732D398dFbC2Ec574CEC: 150 (Gyro)
- 0x8e3fEaAB11b7B351e3EA1E01247Ab6ccc847dD52: 109 (StableSurgePoolFactory)
- 0x86a0E97eC0D5dB8DAE106D3067358d41968fD12c: 8 (GyroECLPPoolFactory)
- 0xC49Ca921c4CD1117162eAEEc0ee969649997950c: 4 (StablePoolFactory)
- 0xFc2986feAB34713E659da84F3B1FA32c1da95832: 1
- 0x6623d1CEEaB236ae93aCAfB285dDFB77336B6981: 1

Try to figure that out.
Source the origin.
Cross chain - larger slippage
Same block or before?


## Sleuthing

Base
https://basescan.org/address/0x91906be1391d2fc7d01a7a6757c69daaefd2c257

28/04, Exit Pool:
https://basescan.org/tx/0x54461c33ec78ab0796196d35465f46921591132fe55b6950fea7cfa0bf5364a3
(Note - minAmountsOut is 0)
Pool Id: 0x2f412099ddb1126365c2a2c5bf90b513806c9b12000000000000000000000314
Does not exist on API/UI. Its from another factory.
https://basescan.org/address/0x2f412099ddb1126365c2a2c5bf90b513806c9b12

Unverified factory: https://basescan.org/address/0xc702573aec8c11a092d56b9fc1fa2a99c50c45a9
Created: https://basescan.org/tx/0xa3d57b0b5768f72c235a59f0c82416cdd6efe1ee410e32217d89fea33761452d
ComposableStable?
Create1: https://basescan.org/tx/0x5b5f9429f563b7783b774015a8852eb7c1791012c90b632fecabfe9868eba89d
  - Pool: 0xd997c1a385964b1f7d0eb1ae402b8bfd6d48428f
  - RP: 0xfD5e57422772dDe882B7a206665A585722B9011d (https://basescan.org/address/0xfd5e57422772dde882b7a206665a585722b9011d, created just before factory)
Create2: https://basescan.org/tx/0x4694c0ce762108421146c5c5f2b2e452d35f87e8c4d549baa2b8f119c0cedd9b
  - Pool: 0x2f412099ddb1126365c2a2c5bf90b513806c9b12
  - RP: 0xfD5e57422772dDe882B7a206665A585722B9011d

1. Create RP: https://basescan.org/address/0x91014bb6dfb55d2e82bac1fb0a70c2c0f9da3fce
2. Create ECLP:
  - https://basescan.org/tx/0x7a233ce35407b10bdbabe3b9629bc10a156801170184f95e02a52e626580fbfe
    - WETH/USDC
    - WETH has RP
    - https://basescan.org/address/0xcd9fa5c7fc4394d1474b2bbb122580a49e275e09#events
3. Initialise ECLP:
  - https://basescan.org/tx/0x4704fe4b05e201394cb9d19f8e0ad50c58988fa7e74c53d912c6413b393361cc
    - ~$3
4 & 5. Does something to RP
6. Swap:
  - https://basescan.org/tx/0xc0b09e80355dcebb6618cd6f43f25bcaa67c2b456ec74941dbeddfc025d68d5f
  - 45241244
  - 0.232357 ($0.23) USDC > 0.0001 ($0.23) WETH 
  - Exact Out. Limit is set.
7. Exits ECLP: https://basescan.org/tx/0x4749d58f748c4bf53004de1ee17eae3dbb540cbd2b86e355f37f116bb2fd0a16

1. Create pool
  - https://polygonscan.com/tx/0xb6645c8fe51a7cf944027d42924b8eb0591dc7933282b660dba09a4376d7cb2f
  - 0x39835081d33c8da6762ab29bc00aaaffd31e6654 
  - RP: 0x0BA53846Fa634facB7E307Ab01Da547BC97082BE
2. Join pool
  - https://polygonscan.com/tx/0xa179ceb20e111e538d6fd866fdf29f40addc726d5d9f21d9a416977b128cbaeb
3. Does rate
4. Swaps
  - https://polygonscan.com/tx/0xd3600ca332d1bb3527978fbb1064cc4ec8e80ac7635ff10ea3e0e74017b9c8d1
5. Some weird swap via a contract
  - https://polygonscan.com/tx/0xc28a794b3996b506bc23ca929af4a1bf0ae3096342aecfc9601b83f618619f90
6. Exit pool
  - https://polygonscan.com/tx/0x0657f0c47e96b93b607ad929b2aa3631820f7e68d8b4731e655549f97a9fe596
  - Quite some time later