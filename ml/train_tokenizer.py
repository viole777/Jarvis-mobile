"""Train a standalone BPE tokenizer for from-scratch Jarvis model experiments.

Important: do NOT replace the tokenizer of a pretrained base model (such as Qwen)
with this tokenizer. A pretrained model's embedding/output weights are tied to its
original vocabulary. This tokenizer is for a future Jarvis model trained from zero.
"""
import argparse
from pathlib import Path
from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders, normalizers

SPECIAL_TOKENS = ["[PAD]", "[UNK]", "[BOS]", "[EOS]", "[USER]", "[ASSISTANT]", "[TEACHER]"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", required=True, help="UTF-8 text file, one or more documents")
    parser.add_argument("--output", default="ml/artifacts/jarvis-tokenizer.json")
    parser.add_argument("--vocab-size", type=int, default=8000)
    args = parser.parse_args()

    corpus = Path(args.corpus)
    if not corpus.is_file():
        raise SystemExit(f"Corpus not found: {corpus}")
    if args.vocab_size < 256:
        raise SystemExit("--vocab-size should be at least 256")

    tokenizer = Tokenizer(models.BPE(unk_token="[UNK]"))
    tokenizer.normalizer = normalizers.NFC()
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(
        vocab_size=args.vocab_size,
        min_frequency=2,
        special_tokens=SPECIAL_TOKENS,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
        show_progress=True,
    )
    tokenizer.train([str(corpus)], trainer)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    tokenizer.save(str(output))

    # Smoke tests catch broken save/load or Portuguese UTF-8 round-trips.
    restored = Tokenizer.from_file(str(output))
    samples = [
        "Olá, Jarvis! Vamos aprender programação.",
        "Ação, informação, coração e segurança cibernética.",
        "print('soma', 2 + 2)",
    ]
    for sample in samples:
        decoded = restored.decode(restored.encode(sample).ids)
        if decoded != sample:
            raise SystemExit(f"Round-trip failed: {sample!r} -> {decoded!r}")
    print(f"tokenizer_saved={output} vocab_size={restored.get_vocab_size()} round_trip_tests={len(samples)}")


if __name__ == "__main__":
    main()
