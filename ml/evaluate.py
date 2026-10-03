import argparse
import json
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    args = parser.parse_args()

    rows = [json.loads(line) for line in Path(args.dataset).read_text(encoding="utf-8").splitlines() if line.strip()]
    tools = 0
    final = 0

    for row in rows:
        answer = row["messages"][-1]["content"]
        payload = json.loads(answer)
        if payload.get("action") == "tool_call":
            tools += 1
        elif payload.get("action") == "final":
            final += 1

    print(f"examples={len(rows)} tool_calls={tools} final={final}")

if __name__ == "__main__":
    main()
