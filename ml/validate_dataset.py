import argparse
import json
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

def validate(path: str):
    errors = []
    count = 0
    for line_no, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        count += 1
        try:
            row = json.loads(line)
            messages = row["messages"]
            assistant = json.loads(messages[-1]["content"])
            action = assistant.get("action")
            if action == "final":
                if not isinstance(assistant.get("text"), str):
                    raise ValueError("final.text must be a string")
            elif action == "tool_call":
                tool = assistant.get("tool")
                if tool not in TOOLS:
                    raise ValueError(f"unknown tool: {tool}")
                args = assistant.get("arguments")
                if not isinstance(args, dict):
                    raise ValueError("arguments must be an object")
            else:
                raise ValueError("action must be tool_call or final")
        except Exception as exc:
            errors.append(f"line {line_no}: {exc}")

    print(f"records={count} valid={count-len(errors)} invalid={len(errors)}")
    for error in errors[:50]:
        print(error)
    return 1 if errors else 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset")
    args = parser.parse_args()
    raise SystemExit(validate(args.dataset))
