import argparse
import json
import os
from pathlib import Path

from openai import OpenAI

TOOLS = [
    {"name": "open_app", "description": "Open an installed Android app.", "arguments": {"packageName": "string"}},
    {"name": "read_screen", "description": "Read accessible screen text.", "arguments": {}},
    {"name": "inspect_screen", "description": "Inspect structured UI elements.", "arguments": {}},
    {"name": "click", "description": "Click an accessible UI element.", "arguments": {"text": "string?", "contentDescription": "string?", "resourceId": "string?"}},
    {"name": "type_text", "description": "Insert text into an editable field. The client may require confirmation.", "arguments": {"text": "string", "targetText": "string?", "targetResourceId": "string?"}},
    {"name": "scroll", "description": "Scroll the active screen.", "arguments": {"direction": "up|down"}},
    {"name": "back", "description": "Navigate back.", "arguments": {}},
]

SYSTEM = """You generate supervised examples for a small Android agent.
Return one JSON object per line and nothing else.
Use only the listed tools.
For consequential actions, prefer examples that make the model request confirmation rather than bypassing safety.
Each record must have:
{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"JSON action..."}]}
Assistant JSON must be either:
{"action":"tool_call","tool":"...","arguments":{...}}
or {"action":"final","text":"..."}.
Vary Brazilian Portuguese phrasing naturally without changing the intended action."""

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=1000)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    client = OpenAI()
    tool_text = json.dumps(TOOLS, ensure_ascii=False, indent=2)

    prompt = f"Generate {args.count} diverse training examples for these Jarvis tools:\n{tool_text}"

    response = client.responses.create(
        model=os.getenv("TEACHER_MODEL", "gpt-5.6-luna"),
        instructions=SYSTEM,
        input=prompt,
        store=False,
    )

    output = response.output_text
    records = []
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            record = json.loads(line)
            records.append(record)
        except json.JSONDecodeError:
            continue

    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"wrote {len(records)} examples to {path}")

if __name__ == "__main__":
    main()
