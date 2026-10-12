"""Evaluate actual model predictions on held-out Jarvis SFT examples."""
import argparse
import json
from pathlib import Path


def parse_json_object(text):
    """Find the first decodable JSON object in model output, including after <think>."""
    decoder = json.JSONDecoder()
    for index, char in enumerate(text):
        if char != "{":
            continue
        try:
            value, _ = decoder.raw_decode(text[index:])
            if isinstance(value, dict):
                return value
        except json.JSONDecodeError:
            continue
    return None


def expected_payload(row):
    return json.loads(row["messages"][-1]["content"])


def load_model(model_path, base_model):
    """Load either a full Transformers model or a PEFT adapter directory."""
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    path = Path(model_path)
    is_adapter = (path / "adapter_config.json").is_file()
    source = base_model if is_adapter else model_path
    tokenizer = AutoTokenizer.from_pretrained(source)
    model = AutoModelForCausalLM.from_pretrained(source, device_map="auto", torch_dtype="auto")
    if is_adapter:
        model = PeftModel.from_pretrained(model, model_path)
    model.eval()
    return tokenizer, model, torch


def predict(tokenizer, model, torch, user_prompt, max_new_tokens):
    prompt = tokenizer.apply_chat_template(
        [{"role": "user", "content": user_prompt}],
        tokenize=False, add_generation_prompt=True,
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    generated = output[0][inputs["input_ids"].shape[-1]:]
    return tokenizer.decode(generated, skip_special_tokens=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True, help="Held-out JSONL dataset")
    parser.add_argument("--model", required=True, help="Full model or PEFT adapter directory")
    parser.add_argument("--base-model", default="Qwen/Qwen3-0.6B",
                        help="Base model used when --model is a PEFT adapter")
    parser.add_argument("--max-new-tokens", type=int, default=128)
    parser.add_argument("--limit", type=int, default=0, help="Optional maximum examples; 0 means all")
    parser.add_argument("--predictions", default="", help="Optional path to save per-example predictions")
    args = parser.parse_args()

    if args.max_new_tokens < 1 or args.limit < 0:
        raise SystemExit("--max-new-tokens must be positive and --limit non-negative")
    rows = [json.loads(line) for line in Path(args.dataset).read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.limit:
        rows = rows[:args.limit]
    if not rows:
        raise SystemExit("Dataset is empty; no evaluation was performed.")

    tokenizer, model, torch = load_model(args.model, args.base_model)
    results = []
    action_correct = exact_correct = parseable = 0
    tool_total = tool_correct = argument_correct = 0

    for index, row in enumerate(rows, 1):
        messages = row.get("messages", [])
        user_messages = [message for message in messages if message.get("role") == "user"]
        if not user_messages:
            raise SystemExit(f"Example {index} has no user message")
        expected = expected_payload(row)
        raw = predict(tokenizer, model, torch, user_messages[-1]["content"], args.max_new_tokens)
        predicted = parse_json_object(raw)
        if predicted is not None:
            parseable += 1
        action_ok = predicted is not None and predicted.get("action") == expected.get("action")
        is_tool_example = expected.get("action") == "tool_call"
        tool_ok = bool(is_tool_example and predicted is not None
                       and predicted.get("action") == "tool_call"
                       and predicted.get("tool") == expected.get("tool"))
        args_ok = bool(tool_ok and predicted.get("arguments") == expected.get("arguments"))
        exact_ok = predicted == expected
        action_correct += int(action_ok)
        if is_tool_example:
            tool_total += 1
            tool_correct += int(tool_ok)
            argument_correct += int(args_ok)
        exact_correct += int(exact_ok)
        results.append({
            "index": index, "prompt": user_messages[-1]["content"],
            "expected": expected, "prediction": predicted, "raw_output": raw,
            "action_correct": bool(action_ok), "tool_correct": bool(tool_ok),
            "arguments_correct": bool(args_ok), "exact_match": bool(exact_ok),
        })
        print(f"[{index}/{len(rows)}] action={bool(action_ok)} tool={bool(tool_ok) if is_tool_example else 'n/a'} args={bool(args_ok) if is_tool_example else 'n/a'} exact={bool(exact_ok)}")

    total = len(rows)
    print("\n=== Jarvis model evaluation ===")
    print(f"examples={total}")
    print(f"parseable_json={parseable}/{total} ({parseable / total:.1%})")
    print(f"action_accuracy={action_correct}/{total} ({action_correct / total:.1%})")
    if tool_total:
        print(f"tool_selection_accuracy={tool_correct}/{tool_total} ({tool_correct / tool_total:.1%})")
        print(f"tool_argument_exact_accuracy={argument_correct}/{tool_total} ({argument_correct / tool_total:.1%})")
    else:
        print("tool_selection_accuracy=n/a (no tool-call examples)")
    print(f"full_payload_exact_match={exact_correct}/{total} ({exact_correct / total:.1%})")
    print("These metrics measure this held-out dataset only; they do not prove general intelligence.")

    if args.predictions:
        target = Path(args.predictions)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("".join(json.dumps(item, ensure_ascii=False) + "\n" for item in results), encoding="utf-8")
        print(f"predictions_saved={target}")


if __name__ == "__main__":
    main()
