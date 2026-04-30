#!/usr/bin/env python3
import csv
import json
from collections import defaultdict
from pathlib import Path

import matplotlib.pyplot as plt


METHOD_SELECTOR = "0x4be54643"
START_BLOCK = 44713999
END_BLOCK = 44755378


def main() -> None:
    pool_study_dir = Path(__file__).resolve().parents[2]
    swap_fees_path = pool_study_dir / "data" / "swapFees" / "swapFees.json"
    rate_compare_path = (
        pool_study_dir
        / "data"
        / "rateCompare"
        / "rateCompare_44713999_44755380.json"
    )
    method_csv_path = (
        pool_study_dir / "data" / "rpMethods" / "rateProviderTransactionList.csv"
    )
    output_dir = pool_study_dir / "plots"
    output_path = output_dir / "cumulative_swap_fees_with_method_markers.png"

    with swap_fees_path.open() as f:
        events = json.load(f)
    with rate_compare_path.open() as f:
        rate_rows = json.load(f)

    fee_by_block: dict[int, float] = defaultdict(float)
    for event in events:
        try:
            block = int(event["blockNumber"])
            fee_usd = float(event.get("fee", {}).get("valueUSD", 0.0))
        except (TypeError, ValueError):
            continue
        if block < START_BLOCK or block > END_BLOCK:
            continue
        fee_by_block[block] += fee_usd

    if not fee_by_block:
        raise RuntimeError(
            f"No usable fee records found in range {START_BLOCK}-{END_BLOCK} "
            f"from {swap_fees_path}"
        )

    blocks = sorted(fee_by_block.keys())
    per_block_fees = [fee_by_block[block] for block in blocks]

    cumulative_fees: list[float] = []
    running_total = 0.0
    for fee in per_block_fees:
        running_total += fee
        cumulative_fees.append(running_total)

    method_blocks: list[int] = []
    with method_csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Method") != METHOD_SELECTOR:
                continue
            try:
                block = int(row["Blockno"])
            except (TypeError, ValueError):
                continue
            if START_BLOCK <= block <= END_BLOCK:
                method_blocks.append(block)

    method_blocks = sorted(set(method_blocks))

    fig, ax = plt.subplots(figsize=(16, 8))
    ax.plot(
        blocks,
        cumulative_fees,
        color="tab:green",
        linewidth=1.8,
        label="cumulative swap fee USD",
    )

    for i, block in enumerate(method_blocks):
        ax.axvline(
            x=block,
            color="blue",
            alpha=0.22,
            linewidth=1,
            label=f"method {METHOD_SELECTOR}" if i == 0 else None,
        )

    rate_blocks: list[int] = []
    rate_provider_values: list[float] = []
    uniswap_values: list[float] = []
    for row in rate_rows:
        try:
            block = int(row["blockNumber"])
            rp = float(row["rateProviderUsdPerWeth"])
            uni = float(row["uniswapUsdPerWeth"])
        except (KeyError, TypeError, ValueError):
            continue
        if block < START_BLOCK or block > END_BLOCK:
            continue
        rate_blocks.append(block)
        rate_provider_values.append(rp)
        uniswap_values.append(uni)

    ax_rate = ax.twinx()
    ax_rate.plot(
        rate_blocks,
        rate_provider_values,
        color="tab:orange",
        linewidth=1.0,
        alpha=0.8,
        label="rateProviderUsdPerWeth",
    )
    ax_rate.plot(
        rate_blocks,
        uniswap_values,
        color="tab:purple",
        linewidth=1.0,
        alpha=0.8,
        label="uniswapUsdPerWeth",
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    ax.set_title("Cumulative swap fees with method markers + rate series")
    ax.set_xlabel("blockNumber")
    ax.set_ylabel("cumulative fee USD")
    ax_rate.set_ylabel("USD per WETH")
    ax.grid(alpha=0.2)
    ax.ticklabel_format(style="plain", axis="x")

    handles, labels = ax.get_legend_handles_labels()
    handles2, labels2 = ax_rate.get_legend_handles_labels()
    ax.legend(handles + handles2, labels + labels2, loc="upper left")

    fig.tight_layout()
    fig.savefig(output_path, dpi=180)
    print(
        f"Wrote {output_path} with {len(blocks)} cumulative points and "
        f"{len(method_blocks)} method markers for {METHOD_SELECTOR} "
        f"in block range {START_BLOCK}-{END_BLOCK}; "
        f"final cumulative fee={cumulative_fees[-1]:.4f} USD; "
        f"rate points={len(rate_blocks)}"
    )


if __name__ == "__main__":
    main()
