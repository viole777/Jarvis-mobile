$ErrorActionPreference = "Stop"
# Deliberate local training run; this script does not run on GitHub's hosted CI.
$Python = if (Test-Path ".venv/Scripts/python.exe") { ".venv/Scripts/python.exe" } else { "python" }
$Train = "ml/data/seed_combined_train.jsonl"
$Validation = "ml/data/seed_validation.jsonl"
$Output = "ml/artifacts/jarvis-intensive-lora"

if (-not (Test-Path $Train)) { throw "Missing $Train" }
if (-not (Test-Path $Validation)) { throw "Missing $Validation" }

& $Python ml/validate_dataset.py $Train
if ($LASTEXITCODE -ne 0) { throw "Training dataset validation failed" }
& $Python ml/validate_dataset.py $Validation
if ($LASTEXITCODE -ne 0) { throw "Validation dataset validation failed" }

Write-Host "Starting LoRA fine-tuning. This downloads the base model if it is not cached."
Write-Host "Settings: 5 epochs, batch size 1, gradient accumulation 8, learning rate 5e-5."
Write-Host "Monitor GPU/RAM and stop if the machine becomes unstable."
& $Python ml/train_lora.py --train $Train --validation $Validation --output $Output --epochs 5 --batch-size 1 --gradient-accumulation 8 --learning-rate 5e-5
if ($LASTEXITCODE -ne 0) { throw "Training failed; inspect the error above." }

& $Python ml/evaluate.py --dataset $Validation --model $Output --predictions ml/artifacts/seed-validation-predictions.jsonl
if ($LASTEXITCODE -ne 0) { throw "Evaluation failed; inspect the error above." }
Write-Host "Training and validation commands completed. Review metrics before using the adapter."
