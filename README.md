# Jarvis Mobile

Assistente pessoal experimental para Android.

## Fase 4 — Orquestração

O agente agora suporta múltiplas etapas por tarefa, limite de rodadas, retry controlado de ferramentas e pausa/retomada de ações que precisam de confirmação.

Exemplo conceitual:

Usuário -> AgentLoop -> modelo -> ferramenta -> resultado -> modelo -> próxima ferramenta

O modelo pode combinar open_app, read_screen, click, type_text, scroll e back para completar uma tarefa.

## Fase 5 — Safety Engine

Antes de uma ferramenta ser executada, o cliente aplica uma política local.

- leitura e navegação simples podem ser automáticas;
- inserção de texto exige confirmação explícita;
- cliques com sinais de compra, pagamento, envio ou exclusão exigem confirmação;
- uma ação recusada é devolvida ao modelo como recusada, em vez de ser executada;
- a interface mostra a ferramenta e os argumentos antes da confirmação.

A Safety Engine fica no Android, perto da execução real da ação. O backend não pode substituir essa confirmação.

## Arquitetura

Android UI
  -> AgentLoop
  -> ModelClient
  -> Backend
  -> Responses API
  -> Tool call
  -> SafetyEngine
  -> AccessibilityService
  -> Tool result
  -> AgentLoop

A chave do provedor de IA permanece exclusivamente no backend.

## Segurança

O Jarvis não deve realizar compras, pagamentos, envio de mensagens, exclusões ou outras ações consequenciais sem confirmação explícita do usuário.

O projeto usa Accessibility Service. A ativação é manual nas configurações do Android.

Para uso fora da rede local, use HTTPS e autenticação adequada.