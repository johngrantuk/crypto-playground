import type { RawPoolEventRow } from './fetchPoolEventsForPool';
import type { AddRemoveEvent } from './types';

function normalizeAddr(a: string): string {
    return a.trim().toLowerCase();
}

function blockNumberToInt(b: number | string): number {
    const n = typeof b === 'number' ? b : Number(b);
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid blockNumber: ${String(b)}`);
    }
    return n;
}

export function filterAddRemoveEventsForSender(params: {
    rows: RawPoolEventRow[];
    targetSender: string;
    poolId: string;
}): AddRemoveEvent[] {
    const { rows, targetSender, poolId } = params;
    const want = normalizeAddr(targetSender);

    const out: AddRemoveEvent[] = [];
    for (const row of rows) {
        if (row.type !== 'ADD' && row.type !== 'REMOVE') {
            continue;
        }
        if (!row.id || !row.sender || row.timestamp === undefined) {
            continue;
        }
        if (normalizeAddr(row.sender) !== want) {
            continue;
        }
        if (!row.tokens || row.tokens.length === 0) {
            continue;
        }
        const v = row.valueUSD;
        if (typeof v !== 'number' || !Number.isFinite(v)) {
            continue;
        }

        out.push({
            id: row.id,
            poolId,
            tx: row.tx,
            type: row.type,
            blockNumber: blockNumberToInt(row.blockNumber),
            timestamp: row.timestamp,
            sender: row.sender,
            valueUSD: v,
            tokens: row.tokens.map((t) => ({
                address: t.address,
                amount: t.amount,
            })),
        });
    }

    out.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) {
            return a.blockNumber - b.blockNumber;
        }
        const txc = a.tx.localeCompare(b.tx);
        if (txc !== 0) {
            return txc;
        }
        return a.id.localeCompare(b.id);
    });

    return out;
}
