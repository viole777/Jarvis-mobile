"""Prepare teacher-generated Jarvis SFT data safely.

This script never trains a model and never calls a teacher API. Generate examples
with generate_synthetic.py (or another teacher), then validate and split them here.
"""
import argparse
import json
import random
from pathlib import Path

TOOLS = {
    "open_app": {"packageName"},
    "read_screen": set(),
    "inspect_screen": set(),
    "click": {"text", "contentDescription", "resourceId"},
    "type_text": {"text", "targetText", "targetResourceId"},
    "scroll": {"direction"},
    "back": set(),
}


def validate_record(row):
    if not isinstance(row, dict) or not isinstance(row.get("messages"), list):
        return "record must contain a messages array"
    messages = row["messages"]
    if len(messages) < 2 or messages[0].get("role") != "user" or messages[-1].get("role") != "assistant":
        return "messages must begin with user and end with assistant"
    if not isinstance(messages[0].get("content"), str) or not messages[0]["content"].strip():
        return "user content must be a non-empty string"
    try:
        answer = json.loads(messages[-1].get("content", ""))
    except (TypeError, json.JSONDecodeError):
        return "assistant content must be a JSON string"
    if not isinstance(answer, dict):
        return "assistant JSON must be an object"
    action = answer.get("action")
    if action == "final":
        if not isinstance(answer.get("text"), str) or not answer["text"].strip():
            return "final action requires non-empty text"
        return None
    if action != "tool_call":
        return "action must be tool_call or final"
    tool = answer.get("tool")
    args = answer.get("arguments")
    if tool not in TOOLS:
        return f"unknown tool: {tool}"
    if not isinstance(args, dict):
        return "arguments must be an object"
    if set(args) - TOOLS[tool]:
        return "arguments contain unsupported keys"
    if tool == "open_app" and not isinstance(args.get("packageName"), str):
        return "open_app requires packageName string"
    if tool == "scroll" and args.get("direction") not in {"up", "down"}:
        return "scroll direction must be up or down"
    if tool == "type_text" and not isinstance(args.get("text"), str):
        return "type_text requires text string"
    if tool == "click" and not any(isinstance(args.get(k), str) and args[k].strip()
                                    for k in ("text", "contentDescription", "resourceId")):
        return "click requires a non-empty target selector"
    return None


def load_jsonl(path):
    rows, errors = [], []
    for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
            problem = validate_record(row)
            if problem:
                errors.append(f"{path}:{line_number}: {problem}")
            else:
                rows.append(row)
        except json.JSONDecodeError as exc:
            errors.append(f"{path}:{line_number}: invalid JSON: {exc.msg}")
    return rows, errors


def write_jsonl(path, rows):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Teacher-generated JSONL")
    parser.add_argument("--output-dir", default="ml/data/prepared")
    parser.add_argument("--validation-ratio", type=float, default=0.1)
    parser.add_argument("--test-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.validation_ratio < 0 or args.test_ratio < 0 or args.validation_ratio + args.test_ratio >= 1:
        raise SystemExit("validation/test ratios must be non-negative and sum to less than 1")

    rows, errors = load_jsonl(args.input)
    for error in errors[:50]:
        print("INVALID:", error)
    print(f"valid={len(rows)} invalid={len(errors)}")
    if errors:
        raise SystemExit("Fix invalid teacher outputs before preparing the dataset.")
    if len(rows) < 10:
        raise SystemExit("At least 10 valid examples are required for a meaningful split.")

    # Deduplicate by normalized user request + assistant target to avoid accidental repeats.
    unique = {}
    for row in rows:
        key = json.dumps(row["messages"], ensure_ascii=False, sort_keys=True)
        unique[key] = row
    rows = list(unique.values())
    random.Random(args.seed).shuffle(rows)

    n = len(rows)
    n_test = max(1, round(n * args.test_ratio)) if args.test_ratio else 0
    n_val = max(1, round(n * args.validation_ratio)) if args.validation_ratio else 0
    if n_test + n_val >= n:
        raise SystemExit("Not enough unique records for requested split ratios")
    test = rows[:n_test]
    validation = rows[n_test:n_test + n_val]
    train = rows[n_test + n_val:]

    out = Path(args.output_dir)
    write_jsonl(out / "train.jsonl", train)
    write_jsonl(out / "validation.jsonl", validation)
    write_jsonl(out / "test.jsonl", test)
    print(f"deduplicated={n} train={len(train)} validation={len(validation)} test={len(test)}")
    print(f"output_dir={out}")


if __name__ == "__main__":
    main()
