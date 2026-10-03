import argparse
import json
from pathlib import Path

def expected(row):
    return json.loads(row["messages"][-1]["content"])

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    args = parser.parse_args()

    rows = [json.loads(x) for x in Path(args.dataset).read_text(encoding="utf-8").splitlines() if x.strip()]
    tool_exact = 0
    action_exact = 0

    for row in rows:
        target = expected(row)
        prediction = target  # Replace with SLM inference adapter.
        if prediction.get("action") == target.get("action"):
            action_exact += 1
        if prediction == target:
            tool_exact += 1

    total = len(rows)
    print(f"examples={total}")
    print(f"action_exact={action_exact/total if total else 0:.3f}")
    print(f"json_exact={tool_exact/total if total else 0:.3f}")
    print("NOTE: benchmark.py currently uses the target as a placeholder until the inference adapter is connected.")

if __name__ == "__main__":
    main()
