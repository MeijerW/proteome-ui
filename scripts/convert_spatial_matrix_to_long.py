import argparse
import csv
from pathlib import Path


GROUP_BY_PREFIX = {
    "P": "Posterior",
    "A": "Anterior",
    "S": "Somite",
}

ROMAN_TO_INT = {
    "I": 1,
    "II": 2,
    "III": 3,
    "IV": 4,
    "V": 5,
    "VI": 6,
}


def infer_group(sample_name: str) -> str:
    sample_name = (sample_name or "").strip()
    if not sample_name:
        return ""
    return GROUP_BY_PREFIX.get(sample_name[0].upper(), "")


def infer_replicate(sample_name: str) -> str:
    sample_name = (sample_name or "").strip()
    if not sample_name or "-" not in sample_name:
        return ""

    suffix = sample_name.split("-", 1)[1].strip().upper()
    if suffix in ROMAN_TO_INT:
        return str(ROMAN_TO_INT[suffix])
    if suffix.isdigit():
        return suffix
    return ""


def convert_wide_to_long(input_path: Path, output_path: Path) -> None:
    with input_path.open("r", newline="", encoding="utf-8-sig") as infile:
        reader = csv.DictReader(infile)
        if not reader.fieldnames:
            raise ValueError(f"No header found in {input_path}")

        sample_field = None
        for candidate in ("sample", "Sample"):
            if candidate in reader.fieldnames:
                sample_field = candidate
                break

        if sample_field is None:
            raise ValueError(
                f"Expected a 'sample' column in {input_path}, found: {', '.join(reader.fieldnames[:10])}"
            )

        gene_fields = [field for field in reader.fieldnames if field != sample_field]
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with output_path.open("w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(
                outfile,
                fieldnames=["sample", "Gene", "Z-score", "group", "replicate"],
            )
            writer.writeheader()

            for row in reader:
                sample_name = (row.get(sample_field) or "").strip()
                group = infer_group(sample_name)
                replicate = infer_replicate(sample_name)

                for gene_name in gene_fields:
                    value = row.get(gene_name)
                    if value in (None, ""):
                        continue

                    writer.writerow(
                        {
                            "sample": sample_name,
                            "Gene": gene_name,
                            "Z-score": value,
                            "group": group,
                            "replicate": replicate,
                        }
                    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert wide spatial z-score matrices into long-format CSV files."
    )
    parser.add_argument(
        "--rna-input",
        required=True,
        help="Path to the wide RNA z-score CSV (for example rna_zscore.csv).",
    )
    parser.add_argument(
        "--prot-input",
        required=True,
        help="Path to the wide protein z-score CSV (for example prot_zscore.csv).",
    )
    parser.add_argument(
        "--rna-output",
        default="data/rna_zscore_long.csv",
        help="Output path for the converted long-format RNA CSV.",
    )
    parser.add_argument(
        "--prot-output",
        default="data/prot_zscore_long.csv",
        help="Output path for the converted long-format protein CSV.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    convert_wide_to_long(Path(args.rna_input), Path(args.rna_output))
    convert_wide_to_long(Path(args.prot_input), Path(args.prot_output))


if __name__ == "__main__":
    main()