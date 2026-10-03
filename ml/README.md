# Jarvis SLM

A SLM do Jarvis será especializada em intenção -> tool call -> argumentos -> segurança.

## Estratégia

Não treinamos um modelo do zero. Começamos com um modelo pequeno aberto e fazemos SFT com LoRA/QLoRA. A configuração inicial usa `Qwen/Qwen3-0.6B` como baseline.

Pipeline:

1. gerar exemplos sintéticos com um modelo professor;
2. validar JSON e ferramentas permitidas;
3. separar treino/validação/teste;
4. fazer SFT com LoRA;
5. avaliar exact-match de ferramenta e argumentos;
6. exportar o adapter;
7. integrar a SLM ao backend do Jarvis.

## Contrato

A saída da SLM deve ser JSON estrito:

```json
{
  "action": "tool_call",
  "tool": "open_app",
  "arguments": {
    "packageName": "com.android.chrome"
  }
}
```

Para uma resposta sem ferramenta:

```json
{
  "action": "final",
  "text": "Pronto."
}
```

A SLM nunca substitui o Safety Engine. Mesmo que ela produza uma tool call, o Android valida a ação antes da execução.

## Treinamento

Instale:

```bash
pip install -r ml/requirements.txt
```

Gere dados com um modelo professor:

```bash
python ml/generate_synthetic.py --count 2000 --output ml/data/generated.jsonl
```

Treine o adapter:

```bash
python ml/train_lora.py --train ml/data/train.jsonl --output ml/artifacts/jarvis-slm
```

Avalie:

```bash
python ml/evaluate.py --dataset ml/data/test.jsonl
```

O treino deve ser executado em uma máquina com recursos adequados; o Poco não é o alvo de treinamento. O alvo inicial da SLM é inferência eficiente depois da quantização.
