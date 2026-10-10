# Jarvis SLM and teacher-learning pipeline

This folder contains the first practical training pipeline for Jarvis's small language model (SLM), focused on intent classification and Android tool selection. It is not a general-purpose model and does not imply consciousness.

## Independence model

- **Inference:** once trained and deployed with its weights, the student can run without calling a teacher API.
- **Teaching:** external models are optional data generators during development. They are not required at runtime.
- **Learning:** teacher outputs are candidate examples, not truth. Validate them, split datasets, train a new checkpoint, and evaluate before promotion.
- **Safety:** the model never replaces Android's Safety Engine or explicit confirmation for consequential actions.

## Existing student model

The current SFT path starts from `Qwen/Qwen3-0.6B` and applies LoRA. This is a pretrained model, not a model trained from zero. It uses its own tokenizer and vocabulary. **Do not replace the Qwen tokenizer with `train_tokenizer.py` output**: pretrained embedding and output weights are tied to the original vocabulary.

## 1. Install

Use Python 3.11 or 3.12 in a virtual environment on a machine with enough memory. Training is best done on a GPU; CPU training may be very slow.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r ml/requirements.txt
```

## 2. Generate candidate lessons with a teacher

Set a provider API key only on your trusted training machine. It is used to generate data, not for Jarvis inference. Choose a model that your provider actually makes available:

```bash
# Windows PowerShell
$env:OPENAI_API_KEY="..."
$env:TEACHER_MODEL="your-available-model-id"
python ml/generate_synthetic.py --count 100 --batch-size 20 --output ml/data/generated.jsonl
```

Do not commit keys or generated datasets containing personal/sensitive data. Teacher generation may incur provider costs. The script intentionally does not assume a particular model ID.

## 3. Validate and split data

```bash
python ml/teacher_pipeline.py --input ml/data/generated.jsonl --output-dir ml/data/prepared --seed 42
python ml/validate_dataset.py ml/data/prepared/train.jsonl
python ml/validate_dataset.py ml/data/prepared/validation.jsonl
python ml/validate_dataset.py ml/data/prepared/test.jsonl
```

Invalid rows stop the pipeline instead of silently entering training. The pipeline validates tool names/argument shapes, deduplicates exact examples and produces deterministic train/validation/test splits. Review generated examples for factual errors, unsafe behavior, and duplicates before training.

## 4. Train the student adapter

```bash
python ml/train_lora.py --train ml/data/prepared/train.jsonl --output ml/artifacts/jarvis-slm
```

Run training on a machine with appropriate resources. Do not assume the free Render web service can train the model or hold GPU weights.

## 5. Evaluate and run local inference

```bash
python ml/evaluate.py --dataset ml/data/prepared/test.jsonl
python ml/infer.py --model ml/artifacts/jarvis-slm --prompt "Abra o Chrome"
```

The current `evaluate.py` performs a dataset-format/count check; it does **not** measure model predictions or accuracy. Do not report it as a model benchmark. A true benchmark must run the trained model against held-out prompts and compare parsed predicted actions/arguments to expected outputs.

## 6. Optional: train a tokenizer for a future from-scratch Jarvis model

```bash
python ml/train_tokenizer.py --corpus ml/data/language_corpus.txt --vocab-size 8000 --output ml/artifacts/jarvis-tokenizer.json
```

The corpus file must be created from reviewed, licensed/usable text. This creates a BPE tokenizer only; it does not train a neural model. It is for a future model whose embeddings and output layer are trained from scratch, not for the Qwen LoRA path.

## Pipeline

Teacher -> candidate examples -> strict validation/review -> deduplicated splits -> SFT/LoRA -> held-out evaluation -> versioned checkpoint -> explicit promotion.

Do not update production weights directly from a conversation or accept every teacher response as correct. Keep old checkpoints so a regression can be rolled back.
