import argparse
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTConfig, SFTTrainer
from transformers import AutoTokenizer

MODEL = "Qwen/Qwen3-0.6B"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    dataset = load_dataset("json", data_files=args.train, split="train")

    tokenizer = AutoTokenizer.from_pretrained(MODEL)

    def format_example(example):
        return tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )

    peft_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )

    trainer = SFTTrainer(
        model=MODEL,
        train_dataset=dataset,
        formatting_func=format_example,
        peft_config=peft_config,
        args=SFTConfig(
            output_dir=args.output,
            num_train_epochs=2,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=8,
            learning_rate=2e-4,
            logging_steps=10,
            save_strategy="epoch",
            report_to="none",
        ),
    )

    trainer.train()
    trainer.save_model(args.output)

if __name__ == "__main__":
    main()
