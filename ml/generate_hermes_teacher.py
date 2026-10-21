"""Generate candidate Jarvis SFT lessons using an OpenAI-compatible Hermes endpoint.

This script creates candidate data only. It does not train weights, deploy a model,
or treat teacher output as ground truth. Review and validate the generated JSONL.
"""
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
    {"name": "type_text", "description": "Insert text into an editable field. Client confirmation may be required.", "arguments": {"text": "string", "targetText": "string?", "targetResourceId": "string?"}},
    {"name": "scroll", "description": "Scroll the active screen.", "arguments": {"direction": "up|down"}},
    {"name": "back", "description": "Navigate back.", "arguments": {}},
]

SYSTEM = """Você é o Hermes, professor de um agente compacto chamado Jarvis.
Gere exemplos didáticos para treinar seleção de ferramentas e respostas finais.
Responda somente com um objeto JSON contendo a chave "examples", uma lista com
exatamente a quantidade solicitada. Cada item deve ter:
{"messages":[{"role":"user","content":"pedido em português brasileiro"},{"role":"assistant","content":"JSON serializado como string"}]}.
A resposta do assistant deve ser exatamente um destes formatos:
{"action":"tool_call","tool":"NOME","arguments":{...}}
{"action":"final","text":"resposta curta em português"}.
Use somente as ferramentas fornecidas e argumentos válidos. Varie a linguagem sem
alterar a intenção. Inclua pedidos simples e ambíguos; para ambiguidade relevante,
peça esclarecimento como action=final. Nunca finja que uma ação já foi executada.
Para enviar mensagens, pagar, comprar, excluir ou realizar outra ação consequencial,
não crie uma chamada de ferramenta que burle confirmação explícita. Não inclua dados
pessoais reais, segredos ou credenciais. Os exemplos são candidatos e serão validados
separadamente; não afirme que são verdadeiros por terem sido gerados por você."""

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=os.getenv("HERMES_TEACHER_MODEL"))
    parser.add_argument("--base-url", default=os.getenv("HERMES_TEACHER_BASE_URL"))
    args = parser.parse_args()

    api_key = os.getenv("HERMES_TEACHER_API_KEY")
    if not api_key:
        raise SystemExit("Defina HERMES_TEACHER_API_KEY no ambiente seguro de treinamento; nunca a grave no Git.")
    if not args.base_url:
        raise SystemExit("Defina HERMES_TEACHER_BASE_URL com o endpoint OpenAI-compatible do Hermes.")
    if not args.model:
        raise SystemExit("Defina HERMES_TEACHER_MODEL com o identificador do modelo professor.")
    if args.count < 1 or args.batch_size < 1:
        raise SystemExit("--count e --batch-size devem ser positivos.")

    client = OpenAI(api_key=api_key, base_url=args.base_url.rstrip("/"))
    tool_text = json.dumps(TOOLS, ensure_ascii=False)
    records = []
    batches = (args.count + args.batch_size - 1) // args.batch_size
    for batch_index in range(batches):
        wanted = min(args.batch_size, args.count - len(records))
        prompt = (
            f"Gere exatamente {wanted} exemplos distintos para o Jarvis. "
            "Misture chamadas de ferramentas seguras e respostas finais. "
            "Não inclua Markdown. Retorne {\"examples\":[...]}."
            f"\nFERRAMENTAS: {tool_text}"
        )
        response = client.chat.completions.create(
            model=args.model,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content or ""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise SystemExit(f"Resposta Hermes não era JSON válido no lote {batch_index + 1}: {exc}") from exc
        batch = payload.get("examples")
        if not isinstance(batch, list):
            raise SystemExit(f"O lote {batch_index + 1} não contém a lista 'examples'.")
        valid_shape = [
            row for row in batch
            if isinstance(row, dict) and isinstance(row.get("messages"), list)
        ]
        records.extend(valid_shape[:wanted])
        print(f"lote={batch_index + 1}/{batches} candidatos={len(valid_shape)} acumulados={len(records)}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"gravados={len(records)} solicitados={args.count} arquivo={output}")
    if len(records) != args.count:
        raise SystemExit("O Hermes retornou menos exemplos do que o solicitado. Revise a saída e tente lotes menores.")

if __name__ == "__main__":
    main()
