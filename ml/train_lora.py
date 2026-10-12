"""Fine-tune a pretrained causal language model with LoRA for Jarvis tool use."""
import argparse
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer
from transformers import AutoTokenizer

DEFAULT_MODEL = "Qwen/Qwen3-0.6B"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", required=True)
    parser.add_argument("--validation", default="", help="Optional held-out validation JSONL")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Base model ID or local model directory")
    parser.add_argument("--output", required=True)
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    args = parser.parse_args()

    if args.epochs < 1 or args.batch_size < 1 or args.gradient_accumulation < 1:
        raise SystemExit("epochs, batch-size and gradient-accumulation must be positive")
    if args.learning_rate <= 0:
        raise SystemExit("learning-rate must be positive")

    dataset = load_dataset("json", data_files=args.train, split="train")
    validation_dataset = (
        load_dataset("json", data_files=args.validation, split="train")
        if args.validation else None
    )
    if len(dataset) < 2:
        raise SystemExit("At least two training examples are required.")
    if validation_dataset is not None and len(validation_dataset) < 1:
        raise SystemExit("Validation dataset is empty.")

    tokenizer = AutoTokenizer.from_pretrained(args.model)

    def format_example(example):
        return tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False
        )

    peft_config = LoraConfig(
        r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    trainer = SFTTrainer(
        model=args.model,
        train_dataset=dataset,
        eval_dataset=validation_dataset,
        formatting_func=format_example,
        peft_config=peft_config,
        args=SFTConfig(
            output_dir=args.output,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=1,
            gradient_accumulation_steps=args.gradient_accumulation,
            learning_rate=args.learning_rate,
            logging_steps=10,
            save_strategy="epoch",
            eval_strategy="epoch" if validation_dataset is not None else "no",
            report_to="none",
        ),
    )
    trainer.train()
    trainer.save_model(args.output)
    print(f"adapter_saved={args.output}")
    print(f"training_examples={len(dataset)}")
    print(f"validation_examples={len(validation_dataset) if validation_dataset is not None else 0}")


if __name__ == "__main__":
    main()
