# Jarvis SLM and teacher-learning pipeline

This is the experimental ML pipeline for Jarvis. It is a practical first step toward a compact assistant, not a general-purpose brain and not evidence of consciousness.

## Current status

- **Implemented:** teacher-example generation, JSONL validation, deduplication/splitting, LoRA fine-tuning, local inference, and held-out prediction metrics.
- **CI-checked:** Python syntax, output-parser tests, and the checked-in datasets.
- **Not yet demonstrated:** a completed neural training run, a trained checkpoint, a measured improvement, or model integration into the Android/web runtime.
- **Important:** adding text to a repository does not change model weights. Examples only affect behavior after they are used in training; a corpus can also be searched at runtime if a retrieval system is implemented.

## Seed dataset added

`ml/data/seed_train.jsonl` contains 92 original Portuguese examples (76 concise knowledge/assistant-behavior examples and 16 Android tool examples). It is a **starter set**, not enough to create broad intelligence or reliably teach all of programming. It is useful for exercising the data pipeline and beginning controlled experiments.

Use it directly for an initial training smoke test:

```bash
python ml/validate_dataset.py ml/data/seed_train.jsonl
python ml/train_lora.py --train ml/data/seed_train.jsonl --output ml/artifacts/jarvis-seed
```

For a meaningful evaluation, keep a separate, reviewed test set that is not included in training. Do not evaluate only on training examples. The small existing `ml/data/test.jsonl` is mainly an Android-tool smoke test, not a broad benchmark.

## Independence model

- **Inference:** a trained model and its weights can be run without calling a teacher API, if the target device has a compatible inference runtime and sufficient resources.
- **Teaching:** external models are optional data generators during development. They are not required at runtime.
- **Learning:** teacher outputs are candidate examples, not truth. Review factual accuracy, safety, licensing, duplicates, and train/test leakage before training.
- **Memory is not weight learning:** saving a conversation does not automatically retrain the neural network.
- **Safety:** a language model must not bypass Android permissions, the Safety Engine, or explicit confirmation for consequential actions.

## Student model

The current SFT path starts from `Qwen/Qwen3-0.6B` and applies LoRA. This is a pretrained model, not a model trained from scratch. It uses its own tokenizer and vocabulary. **Do not replace the Qwen tokenizer with `train_tokenizer.py` output**: pretrained embedding and output weights are tied to the original vocabulary.

## 1. Install

Use Python 3.11 or 3.12 in a virtual environment. Training is best done on a compatible GPU; CPU training may be very slow.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r ml/requirements.txt
```

## 2. Generate candidate lessons with a teacher (optional)

Set a provider API key only on your trusted training machine. It is used to generate candidate data, not for Jarvis inference. Choose a model actually available to your account:

```powershell
$env:OPENAI_API_KEY="..."
$env:TEACHER_MODEL="your-available-model-id"
python ml/generate_synthetic.py --count 100 --batch-size 20 --output ml/data/generated.jsonl
```

Teacher generation may incur provider costs. Do not commit keys or datasets containing personal/sensitive data. The generator intentionally does not assume a particular model ID.

## 3. Validate and split generated data

```bash
python ml/teacher_pipeline.py --input ml/data/generated.jsonl --output-dir ml/data/prepared --seed 42
python ml/validate_dataset.py ml/data/prepared/train.jsonl
python ml/validate_dataset.py ml/data/prepared/validation.jsonl
python ml/validate_dataset.py ml/data/prepared/test.jsonl
```

Invalid rows stop the pipeline. The pipeline validates supported tool names/argument shapes, deduplicates exact examples and creates deterministic train/validation/test splits. It cannot prove factual truth; manually review generated lessons before training.

## 4. Train the student adapter

```bash
python ml/train_lora.py --train ml/data/prepared/train.jsonl --validation ml/data/prepared/validation.jsonl --output ml/artifacts/jarvis-slm
```

Optional parameters include `--model`, `--epochs`, `--batch-size`, `--gradient-accumulation` and `--learning-rate`. Run training on a machine with appropriate resources. A free web-service instance should not be assumed to have a training GPU.

## 5. Evaluate predictions and run local inference

```bash
python ml/evaluate.py --dataset ml/data/prepared/test.jsonl --model ml/artifacts/jarvis-slm --predictions ml/artifacts/test-predictions.jsonl
python ml/infer.py --model ml/artifacts/jarvis-slm --prompt "Abra o Chrome"
```

Both scripts support a saved PEFT adapter and load the configured base model (default `Qwen/Qwen3-0.6B`). Use `--base-model` if the adapter was trained from another model.

The evaluator measures JSON parseability, action accuracy, tool selection, exact tool arguments, and full-payload exact match. These metrics only describe the supplied test set; exact-match scores are not a general measure of reasoning. Keep a larger, reviewed benchmark before claiming improvement.

Run lightweight tests:

```bash
python -m unittest discover -s ml/tests -v
```

## 6. Optional tokenizer for a future from-scratch model

```bash
python ml/train_tokenizer.py --corpus ml/data/language_corpus.txt --vocab-size 8000 --output ml/artifacts/jarvis-tokenizer.json
```

This trains a BPE tokenizer only, not a neural model. Use reviewed, licensed/usable text. It is for a future model whose embeddings and output layer are trained from scratch, not for the Qwen LoRA path.

## Pipeline

Candidate lessons -> validation/review -> deduplicated splits -> SFT/LoRA -> held-out evaluation -> versioned checkpoint -> explicit promotion.

The next major engineering step is integrating a real inference provider into the actual Jarvis runtime. The current browser UI's reply logic remains separate from this training pipeline, so training this adapter will not automatically remove the existing generic `if/else` responses.
