import { PROFIT_STUDY_CONFIG, type Address } from './config';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const viem = require('viem') as {
    createPublicClient: (params: { chain: unknown; transport: unknown }) => any;
    http: (url: string) => unknown;
    parseAbiItem: (abi: string) => unknown;
    decodeEventLog: (params: any) => any;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chains = require('viem/chains') as { base: unknown };

const { createPublicClient, http, parseAbiItem, decodeEventLog } = viem;
const { base } = chains;

type JoinExitDirection = 'join' | 'exit';

type TxLeg = {
    txHash: `0x${string}`;
    blockNumber: bigint;
    timestamp: bigint;
    wethAmount: bigint;
    usdcAmount: bigint;
    gasCostEth: bigint;
};

export type JoinExitData = {
    join: TxLeg;
    exit: TxLeg;
    bptSupplyDeltaJoin: bigint;
    bptBurnDeltaExit: bigint;
};

const transferAbi = parseAbiItem(
    'event Transfer(address indexed from, address indexed to, uint256 value)'
);
const poolBalanceChangedAbi = parseAbiItem(
    'event PoolBalanceChanged(bytes32 indexed poolId, address indexed liquidityProvider, address[] tokens, int256[] deltas, uint256[] protocolFeeAmounts)'
);

function normalizeAddress(address: string): Address {
    return address.toLowerCase() as Address;
}

function pickTokenAmountFromTransfers(params: {
    receipt: any;
    tokenAddress: Address;
    direction: JoinExitDirection;
}): bigint {
    const { receipt, tokenAddress, direction } = params;
    const token = normalizeAddress(tokenAddress);
    const lp = normalizeAddress(PROFIT_STUDY_CONFIG.lpAddress);
    const vault = normalizeAddress(PROFIT_STUDY_CONFIG.vaultAddress);

    const matching = (receipt.logs ?? [])
        .filter(
            (log: any) =>
                normalizeAddress(log.address) === token &&
                Array.isArray(log.topics) &&
                log.topics.length > 0
        )
        .map((log: any) => {
            try {
                return decodeEventLog({
                    abi: [transferAbi],
                    data: log.data,
                    topics: log.topics,
                    strict: false,
                });
            } catch (_err) {
                return null;
            }
        })
        .filter(Boolean) as any[];

    const transfer = matching.find((evt: any) => {
        const from = normalizeAddress(evt.args.from);
        const to = normalizeAddress(evt.args.to);
        if (direction === 'join') {
            return from === lp && to === vault;
        }
        return from === vault && to === lp;
    });

    if (!transfer) {
        throw new Error(
            `Could not find token Transfer for ${tokenAddress} in ${direction} tx`
        );
    }

    return transfer.args.value as bigint;
}

function pickVaultDeltas(params: {
    receipt: any;
    direction: JoinExitDirection;
}): { wethDelta: bigint; usdcDelta: bigint } {
    const { receipt, direction } = params;
    const lp = normalizeAddress(PROFIT_STUDY_CONFIG.lpAddress);
    const poolId = PROFIT_STUDY_CONFIG.poolId.toLowerCase();

    const events = (receipt.logs ?? [])
        .map((log: any) => {
            try {
                return {
                    decoded: decodeEventLog({
                        abi: [poolBalanceChangedAbi],
                        data: log.data,
                        topics: log.topics,
                        strict: false,
                    }),
                    address: normalizeAddress(log.address),
                };
            } catch (_err) {
                return null;
            }
        })
        .filter(Boolean) as Array<{ decoded: any; address: Address }>;

    const event = events.find((entry) => {
        const { decoded, address } = entry;
        if (address !== normalizeAddress(PROFIT_STUDY_CONFIG.vaultAddress)) {
            return false;
        }
        const evPoolId = (decoded.args.poolId as string).toLowerCase();
        const evLp = normalizeAddress(decoded.args.liquidityProvider as string);
        return evPoolId === poolId && evLp === lp;
    });

    if (!event) {
        throw new Error(`Missing PoolBalanceChanged event for ${direction} tx`);
    }

    const tokens = (event.decoded.args.tokens as Address[]).map((addr) =>
        normalizeAddress(addr)
    );
    const deltas = event.decoded.args.deltas as bigint[];

    const wethIdx = tokens.indexOf(
        normalizeAddress(PROFIT_STUDY_CONFIG.tokenWeth)
    );
    const usdcIdx = tokens.indexOf(
        normalizeAddress(PROFIT_STUDY_CONFIG.tokenUsdc)
    );
    if (wethIdx < 0 || usdcIdx < 0) {
        throw new Error(`PoolBalanceChanged missing WETH/USDC token entries`);
    }
    return { wethDelta: deltas[wethIdx], usdcDelta: deltas[usdcIdx] };
}

function validateDirectionDeltas(params: {
    direction: JoinExitDirection;
    wethDelta: bigint;
    usdcDelta: bigint;
}): void {
    const { direction, wethDelta, usdcDelta } = params;
    if (direction === 'join') {
        if (wethDelta <= 0n || usdcDelta <= 0n) {
            throw new Error('Join PoolBalanceChanged deltas must be positive');
        }
        return;
    }
    if (wethDelta >= 0n || usdcDelta >= 0n) {
        throw new Error('Exit PoolBalanceChanged deltas must be negative');
    }
}

function pickBptTransfer(params: {
    receipt: any;
    direction: JoinExitDirection;
}): bigint {
    const { receipt, direction } = params;
    const lp = normalizeAddress(PROFIT_STUDY_CONFIG.lpAddress);
    const poolAddress = normalizeAddress(PROFIT_STUDY_CONFIG.poolAddress);
    const zero = normalizeAddress('0x0000000000000000000000000000000000000000');

    const bptTransfers = (receipt.logs ?? [])
        .filter((log: any) => normalizeAddress(log.address) === poolAddress)
        .map((log: any) => {
            try {
                return decodeEventLog({
                    abi: [transferAbi],
                    data: log.data,
                    topics: log.topics,
                    strict: false,
                });
            } catch (_err) {
                return null;
            }
        })
        .filter(Boolean) as any[];

    if (direction === 'join') {
        const mint = bptTransfers.find((evt: any) => {
            const from = normalizeAddress(evt.args.from);
            const to = normalizeAddress(evt.args.to);
            return from === zero && to === lp;
        });
        if (!mint) throw new Error('Missing BPT mint transfer in join tx');
        return mint.args.value as bigint;
    }

    const burn = bptTransfers.find((evt: any) => {
        const from = normalizeAddress(evt.args.from);
        const to = normalizeAddress(evt.args.to);
        return from === lp && to === zero;
    });
    if (!burn) throw new Error('Missing BPT burn transfer in exit tx');
    return burn.args.value as bigint;
}

async function readLeg(params: {
    client: any;
    txHash: `0x${string}`;
    direction: JoinExitDirection;
}): Promise<{
    leg: TxLeg;
    bptDelta: bigint;
    vaultDeltas: { wethDelta: bigint; usdcDelta: bigint };
}> {
    const { client, txHash, direction } = params;
    const receipt = await client.getTransactionReceipt({ hash: txHash });
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const tx = await client.getTransaction({ hash: txHash });

    const wethAmount = pickTokenAmountFromTransfers({
        receipt,
        tokenAddress: PROFIT_STUDY_CONFIG.tokenWeth,
        direction,
    });
    const usdcAmount = pickTokenAmountFromTransfers({
        receipt,
        tokenAddress: PROFIT_STUDY_CONFIG.tokenUsdc,
        direction,
    });
    const vaultDeltas = pickVaultDeltas({ receipt, direction });
    validateDirectionDeltas({ direction, ...vaultDeltas });

    const expectedWeth =
        direction === 'join' ? vaultDeltas.wethDelta : -vaultDeltas.wethDelta;
    const expectedUsdc =
        direction === 'join' ? vaultDeltas.usdcDelta : -vaultDeltas.usdcDelta;
    if (expectedWeth !== wethAmount || expectedUsdc !== usdcAmount) {
        throw new Error(
            `${direction} transfer amounts do not match PoolBalanceChanged deltas`
        );
    }

    const bptDelta = pickBptTransfer({ receipt, direction });

    const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
    const gasUsed = BigInt(receipt.gasUsed);
    const leg: TxLeg = {
        txHash,
        blockNumber: receipt.blockNumber,
        timestamp: block.timestamp,
        wethAmount,
        usdcAmount,
        gasCostEth: effectiveGasPrice * gasUsed,
    };
    if (
        normalizeAddress(tx.to ?? '') !==
        normalizeAddress(PROFIT_STUDY_CONFIG.vaultAddress)
    ) {
        throw new Error(`${direction} tx target is not the configured vault`);
    }
    return { leg, bptDelta, vaultDeltas };
}

export async function fetchJoinExitData(): Promise<JoinExitData> {
    const client = createPublicClient({
        chain: base,
        transport: http(PROFIT_STUDY_CONFIG.baseRpcUrl),
    });

    const [join, exit] = await Promise.all([
        readLeg({
            client,
            txHash: PROFIT_STUDY_CONFIG.joinTxHash,
            direction: 'join',
        }),
        readLeg({
            client,
            txHash: PROFIT_STUDY_CONFIG.exitTxHash,
            direction: 'exit',
        }),
    ]);

    return {
        join: join.leg,
        exit: exit.leg,
        bptSupplyDeltaJoin: join.bptDelta,
        bptBurnDeltaExit: exit.bptDelta,
    };
}
