"""Run local inference with a full Transformers model or a PEFT adapter."""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Full model or PEFT adapter directory")
    parser.add_argument("--base-model", default="Qwen/Qwen3-0.6B",
                        help="Base model used when --model is a PEFT adapter")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--max-new-tokens", type=int, default=128)
    args = parser.parse_args()

    if args.max_new_tokens < 1:
        raise SystemExit("--max-new-tokens must be positive")

    import torch
    from peft import PeftModel
    from transformers import AutoTokenizer, AutoModelForCausalLM

    path = Path(args.model)
    is_adapter = (path / "adapter_config.json").is_file()
    source = args.base_model if is_adapter else args.model
    tokenizer = AutoTokenizer.from_pretrained(source)
    model = AutoModelForCausalLM.from_pretrained(
        source, device_map="auto", torch_dtype="auto"
    )
    if is_adapter:
        model = PeftModel.from_pretrained(model, args.model)
    model.eval()

    prompt = tokenizer.apply_chat_template(
        [{"role": "user", "content": args.prompt}],
        tokenize=False,
        add_generation_prompt=True,
    )
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.inference_mode():
        output = model.generate(
            **inputs, max_new_tokens=args.max_new_tokens, do_sample=False
        )
    print(tokenizer.decode(
        output[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True
    ))


if __name__ == "__main__":
    main()
