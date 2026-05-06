#!/usr/bin/env python3
import csv
import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter


METHOD_SELECTOR = "0x11e17d9b"


def main() -> None:
    study2_dir = Path(__file__).resolve().parents[2]
    json_path = (
        study2_dir
        / "data"
        / "rateCompare"
        / "baseRp_45597404_45602842.json"
    )
    method_csv_path = (
        study2_dir / "data" / "rpMethods" / "rateProviderTransactionList.csv"
    )
    output_path = (
        study2_dir
        / "data"
        / "rpMethods"
        / "base_rate_with_0x11e17d9b_markers.png"
    )

    with json_path.open() as f:
        data = json.load(f)

    blocks = [int(row["blockNumber"]) for row in data]
    rates = [float(row["rateDecimal"]) for row in data]
    min_block = blocks[0]
    max_block = blocks[-1]

    method_blocks: list[int] = []
    with method_csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Method") != METHOD_SELECTOR:
                continue
            try:
                method_blocks.append(int(row["Blockno"]))
            except (TypeError, ValueError):
                continue

    method_blocks = sorted(
        {b for b in method_blocks if min_block <= b <= max_block}
    )

    fig, ax = plt.subplots(figsize=(16, 8))
    ax.plot(blocks, rates, label="rateDecimal", linewidth=1)

    for i, block in enumerate(method_blocks):
        ax.axvline(
            x=block,
            color="blue",
            alpha=0.25,
            linewidth=1,
            label=f"method {METHOD_SELECTOR}" if i == 0 else None,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    ax.set_title("Base RP rate with method markers")
    ax.set_xlabel("blockNumber")
    ax.set_ylabel("Rate (decimal)")
    ax.grid(alpha=0.2)
    xfmt = ScalarFormatter(useOffset=False)
    xfmt.set_scientific(False)
    ax.xaxis.set_major_formatter(xfmt)
    ax.tick_params(axis="x", labelrotation=30)
    ax.legend(loc="upper left")
    fig.tight_layout()
    fig.savefig(output_path, dpi=180)

    print(
        f"Wrote {output_path} with {len(method_blocks)} "
        f"method markers for {METHOD_SELECTOR}"
    )


if __name__ == "__main__":
    main()
