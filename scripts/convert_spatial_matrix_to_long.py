import argparse
import csv
import math
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


def convert_rna_matrix_to_long(input_path: Path, output_path: Path) -> int:
    with input_path.open("r", newline="", encoding="utf-8-sig") as infile:
        reader = csv.reader(infile, delimiter="\t")
        header = next(reader, None)
        if not header:
            raise ValueError(f"No header found in {input_path}")

        try:
            sample_index = header.index("sample")
        except ValueError as exc:
            raise ValueError(
                f"Expected a 'sample' column in {input_path}, found: {', '.join(header[:10])}"
            ) from exc

        gene_columns = []
        for index, name in enumerate(header):
            clean_name = (name or "").strip()
            if index == sample_index:
                continue
            # Skip the unnamed row-index column present in harmonized RNA matrices.
            if not clean_name:
                continue
            gene_columns.append((index, clean_name))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        row_count = 0

        with output_path.open("w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(
                outfile,
                fieldnames=["sample", "Gene", "value", "group", "replicate"],
            )
            writer.writeheader()

            for row in reader:
                if not row:
                    continue

                sample_name = (row[sample_index] if sample_index < len(row) else "").strip()
                if not sample_name:
                    continue
                group = infer_group(sample_name)
                replicate = infer_replicate(sample_name)

                for column_index, gene_name in gene_columns:
                    value = row[column_index] if column_index < len(row) else ""
                    if value in (None, ""):
                        continue

                    try:
                        numeric_value = float(value)
                    except ValueError as exc:
                        raise ValueError(
                            f"Non-numeric RNA value for gene '{gene_name}' in sample '{sample_name}': {value}"
                        ) from exc

                    if numeric_value < 0:
                        raise ValueError(
                            f"Negative RNA value for gene '{gene_name}' in sample '{sample_name}': {numeric_value}"
                        )

                    # RNA source matrix is not log-transformed yet; apply log2(x+1) once here.
                    log2_value = math.log2(numeric_value + 1.0)

                    writer.writerow(
                        {
                            "sample": sample_name,
                            "Gene": gene_name,
                            "value": log2_value,
                            "group": group,
                            "replicate": replicate,
                        }
                    )
                    row_count += 1

    return row_count


def infer_group_from_replicate_column(column_name: str) -> str:
    key = (column_name or "").strip().split("_", 1)[0].upper()
    return GROUP_BY_PREFIX.get(key, "")


def infer_replicate_from_column(column_name: str) -> str:
    parts = (column_name or "").strip().split("_")
    if not parts:
        return ""
    tail = parts[-1]
    digits = "".join(char for char in tail if char.isdigit())
    return digits


def convert_protein_matrix_to_long(input_path: Path, output_path: Path) -> int:
    with input_path.open("r", newline="", encoding="utf-8-sig") as infile:
        reader = csv.DictReader(infile, delimiter="\t")
        if not reader.fieldnames:
            raise ValueError(f"No header found in {input_path}")

        gene_field = None
        for candidate in ("gene", "Gene", "ID", "id"):
            if candidate in reader.fieldnames:
                gene_field = candidate
                break
        if gene_field is None:
            raise ValueError(
                f"Expected a gene column in {input_path}, found: {', '.join(reader.fieldnames[:10])}"
            )

        replicate_columns = [
            name
            for name in reader.fieldnames
            if name != gene_field and name and "repl" in name.lower()
        ]
        if not replicate_columns:
            raise ValueError(
                f"No replicate columns found in {input_path}; header starts with: {', '.join(reader.fieldnames[:10])}"
            )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        row_count = 0

        with output_path.open("w", newline="", encoding="utf-8") as outfile:
            writer = csv.DictWriter(
                outfile,
                fieldnames=["sample", "Gene", "value", "group", "replicate"],
            )
            writer.writeheader()

            for row in reader:
                gene_name = (row.get(gene_field) or "").strip()
                if not gene_name:
                    continue

                for column_name in replicate_columns:
                    value = row.get(column_name)
                    if value in (None, ""):
                        continue
                    writer.writerow(
                        {
                            "sample": column_name,
                            "Gene": gene_name,
                            "value": value,
                            "group": infer_group_from_replicate_column(column_name),
                            "replicate": infer_replicate_from_column(column_name),
                        }
                    )
                    row_count += 1

    return row_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert harmonized spatial RNA/protein matrices into long-format CSV files."
    )
    parser.add_argument(
        "--rna-input",
        required=True,
        help="Path to the harmonized RNA matrix (for example normalized_counts_20260528_harmonized.txt).",
    )
    parser.add_argument(
        "--prot-input",
        required=True,
        help="Path to the harmonized protein matrix (for example dep_spatial_assay_20260528_harmonized.txt).",
    )
    parser.add_argument(
        "--rna-output",
        default="data/rna_zscore_long_harmonized_20260528.csv",
        help="Output path for the converted long-format RNA CSV (harmonized naming).",
    )
    parser.add_argument(
        "--prot-output",
        default="data/prot_zscore_long_harmonized_20260528.csv",
        help="Output path for the converted long-format protein CSV (harmonized naming).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rna_count = convert_rna_matrix_to_long(Path(args.rna_input), Path(args.rna_output))
    prot_count = convert_protein_matrix_to_long(Path(args.prot_input), Path(args.prot_output))
    print(f"Wrote {rna_count:,} RNA rows to {args.rna_output}")
    print(f"Wrote {prot_count:,} protein rows to {args.prot_output}")


if __name__ == "__main__":
    main()