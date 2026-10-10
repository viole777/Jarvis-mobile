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
Return JSON Lines only: one independent JSON object per line, no markdown.
Use only the listed tools. Never claim an action has already been executed.
For consequential actions (sending, deleting, purchasing, paying), output a final response
that requests explicit confirmation instead of inventing or bypassing a tool.
Each record must have:
{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"JSON action..."}]}
Assistant JSON must be either:
{"action":"tool_call","tool":"...","arguments":{...}}
or {"action":"final","text":"..."}.
Vary Brazilian Portuguese phrasing naturally without changing the intended action."""

def parse_records(text):
    records = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("```"):
            continue
        try:
            value = json.loads(line)
            if isinstance(value, dict):
                records.append(value)
        except json.JSONDecodeError:
            continue
    return records


def main():
    parser = argparse.ArgumentParser(description="Generate candidate SFT examples using a configured teacher model.")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=os.getenv("TEACHER_MODEL"))
    args = parser.parse_args()

    if args.count < 1 or args.batch_size < 1:
        raise SystemExit("--count and --batch-size must be positive")
    if not args.model:
        raise SystemExit("Configure TEACHER_MODEL or pass --model. No provider/model is assumed.")
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit("Set OPENAI_API_KEY for the teacher provider. This key is only for data generation, not Jarvis inference.")

    client = OpenAI()
    tool_text = json.dumps(TOOLS, ensure_ascii=False, indent=2)
    records = []
    batches = (args.count + args.batch_size - 1) // args.batch_size
    for index in range(batches):
        wanted = min(args.batch_size, args.count - len(records))
        prompt = (
            f"Generate exactly {wanted} distinct examples for these Jarvis tools. "
            "Return one JSON object per line. Avoid duplicates and include both tool calls and final responses.\n"
            f"TOOLS:\n{tool_text}"
        )
        response = client.responses.create(
            model=args.model,
            instructions=SYSTEM,
            input=prompt,
            store=False,
        )
        batch = parse_records(response.output_text)
        records.extend(batch[:wanted])
        print(f"batch={index + 1}/{batches} parsed={len(batch)} accepted_so_far={len(records)}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"wrote={len(records)} requested={args.count} path={output}")
    if len(records) < args.count:
        raise SystemExit("Teacher returned fewer parseable records than requested. Validate output and retry for missing examples.")

if __name__ == "__main__":
    main()
