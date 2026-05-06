// npx ts-node balancer/rpManipulation/study2/data/rateCompare/sampleBaseRpByBlock.ts
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const viem = require('viem') as {
    createPublicClient: (params: { chain: unknown; transport: unknown }) => any;
    http: (url: string) => unknown;
    parseAbi: (abi: unknown) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chains = require('viem/chains') as { base: unknown };

const { createPublicClient, http, parseAbi } = viem;
const { base } = chains;

type Address = `0x${string}`;

type Sample = {
    blockNumber: string;
    rateRawX18: string | null;
    rateDecimal: string | null;
};

/**
 * Base pool in study2:
 * - ADD at block 45597404
 * - REMOVE at block 45602842
 */
const START_BLOCK = 45597404n;
const END_BLOCK = 45602842n;
const STRIDE = 1n;

// Base RP from study2.md (WETH/cbBTC pool)
const RATE_PROVIDER = '0x81225b69fdb536f4ff6d539892185de50e240749' as Address;

const BASE_RPC_URL = process.env.BASE_RPC_URL;
if (!BASE_RPC_URL) {
    throw new Error('Missing BASE_RPC_URL in environment (.env).');
}

const OUTPUT_FILE = `balancer/rpManipulation/study2/data/rateCompare/baseRp_${START_BLOCK.toString()}_${END_BLOCK.toString()}.json`;

const RATE_PROVIDER_ABI = parseAbi([
    'function getRate() view returns (uint256)',
]);

const TEN_18 = 10n ** 18n;

function formatX18ToDecimal(value: bigint): string {
    const whole = value / TEN_18;
    const fraction = (value % TEN_18).toString().padStart(18, '0');
    return `${whole.toString()}.${fraction}`;
}

async function main(): Promise<void> {
    if (END_BLOCK < START_BLOCK) {
        throw new Error('END_BLOCK must be >= START_BLOCK');
    }
    if (STRIDE <= 0n) {
        throw new Error('STRIDE must be > 0');
    }

    const publicClient = createPublicClient({
        chain: base,
        transport: http(BASE_RPC_URL),
    });

    const samples: Sample[] = [];
    console.log('blockNumber,rateDecimal');

    for (let b = START_BLOCK; b <= END_BLOCK; b += STRIDE) {
        let rateRaw: bigint | null = null;
        try {
            rateRaw = (await publicClient.readContract({
                address: RATE_PROVIDER,
                abi: RATE_PROVIDER_ABI,
                functionName: 'getRate',
                blockNumber: b,
            })) as bigint;
        } catch (_err) {
            rateRaw = null;
        }

        const row: Sample = {
            blockNumber: b.toString(),
            rateRawX18: rateRaw === null ? null : rateRaw.toString(),
            rateDecimal: rateRaw === null ? null : formatX18ToDecimal(rateRaw),
        };

        samples.push(row);
        console.log([row.blockNumber, row.rateDecimal ?? ''].join(','));

        if ((b - START_BLOCK) % (STRIDE * 100n) === 0n) {
            console.log(`# progress: b=${b.toString()}`);
        }
    }

    mkdirSync('balancer/rpManipulation/study2/data/rateCompare', {
        recursive: true,
    });
    writeFileSync(OUTPUT_FILE, JSON.stringify(samples, null, 2));
    console.log(`\nWrote ${samples.length} samples to ${OUTPUT_FILE}`);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
