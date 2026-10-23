# Jarvis Mobile

Assistente pessoal experimental para Android.

## Fase 4 — Orquestração

O agente agora suporta múltiplas etapas por tarefa, limite de rodadas, retry controlado de ferramentas e pausa/retomada de ações que precisam de confirmação.

Exemplo conceitual:

Usuário -> AgentLoop -> modelo -> ferramenta -> resultado -> modelo -> próxima ferramenta

O modelo pode combinar open_app, read_screen, click, type_text, scroll e back para completar uma tarefa.

## Execução de ferramentas

A camada genérica Safety Engine foi removida. O agente executa navegação e tarefas comuns diretamente; ações irreversíveis (por exemplo, enviar, pagar, comprar ou excluir) ainda pedem confirmação local. O reconhecimento de fala transcreve o áudio, mas não prova sozinho a identidade de quem falou.

## Backend em nuvem sem chave de provedor no app\n\nO app Android agora usa por padrão o Worker Cloudflare do projeto (`https://jarvis-v2-cloud.viole-jarvis.workers.dev`), que executa modelos pelo binding nativo Workers AI; não é necessário colocar uma chave de OpenAI ou Anthropic no APK. O campo de autenticação ainda exige o token de acesso do Worker. O endpoint `/v1/agent` recebe o catálogo de ferramentas do Android e devolve um plano JSON; a execução continua no aparelho, com confirmação local para ações irreversíveis.\n\nPara controlar outros apps, instale o APK, abra o Jarvis e ative manualmente o serviço de Acessibilidade nas configurações do Android. O Android pode limitar o serviço de microfone em segundo plano; o reconhecimento de voz requer permissões e pode variar conforme fabricante/versão.\n\n## Arquitetura

Android UI
  -> AgentLoop
  -> ModelClient
  -> Backend
  -> Responses API
  -> Tool call
  -> ToolExecutor (confirmação mínima para ações irreversíveis)
  -> AccessibilityService
  -> Tool result
  -> AgentLoop

O app não contém uma chave de provedor de IA; as chamadas ao modelo passam pelo Worker autenticado.

## Segurança

O Jarvis não deve realizar compras, pagamentos, envio de mensagens, exclusões ou outras ações consequenciais sem confirmação explícita do usuário.

O projeto usa Accessibility Service. A ativação é manual nas configurações do Android.

Para uso fora da rede local, use HTTPS e autenticação adequada.

## Fase 6 — Percepção + SLM

A ferramenta `inspect_screen` fornece uma representação estruturada da interface ativa, incluindo texto, content descriptions, resource IDs, classe, estado de interação e limites aproximados dos elementos.

A pasta `ml/` contém a primeira fundação da SLM especializada do Jarvis:

- dataset mínimo de tool calling;
- gerador de exemplos sintéticos usando um modelo professor;
- script de SFT com LoRA;
- avaliação inicial;
- contrato de saída JSON.

Baseline inicial: `Qwen/Qwen3-0.6B`. O objetivo é especializar o modelo para intenção, seleção de ferramentas e argumentos; a confirmação local continua sendo necessária para ações irreversíveis.


## Jarvis V1 — agente com LLM

O backend agora possui um cliente AIsa compatível com Chat Completions, a rota autenticada `POST /v1/chat` para a interface web e `POST /v1/agent` para o cliente Android/tool calling. Configure os segredos no host de deploy seguindo [docs/AISA-V1-SETUP.md](docs/AISA-V1-SETUP.md). A interface web intercepta prompts como `Configurar AIsa: SUA_CHAVE` e envia a chave ao endpoint autenticado de configuração sem incluí-la no histórico do modelo. Essa configuração por prompt é temporária (memória do processo); para persistência após reinícios, configure `AISA_API_KEY` no gerenciador de segredos do host.

A integração do modelo não significa que Skills externas do marketplace ou MCP já estejam conectadas. Consulte o guia para limites atuais e passos de segurança.

## Jarvis Android (native)

The Android client includes a Compose command center with a central animated core, configurable Cloudflare Worker endpoint, local bearer-token storage, voice activation ("Jarvis" or two claps), Android Accessibility-based screen inspection, app launch, click, text entry, scrolling and Back actions. Irreversible actions can be paused by a lightweight local confirmation step.

- Enable the Android Accessibility service in Settings before asking Jarvis to operate other apps.
- Enable microphone permission and tap **Ativar voz contínua** to use wake-word mode. A foreground notification remains visible while listening; stop voice mode in the app when you do not want it listening.
- Spoken responses use the device's installed Portuguese text-to-speech voice. This is not an exact reproduction of the Iron Man film voice, and wake-word recognition depends on the device speech recognizer.
- Android automation is limited by each app's accessibility tree, OS restrictions and the permissions granted by the device owner. It cannot guarantee every action works in every app.

### Build Android APK

Every push that changes the Android app triggers the **Android debug APK** GitHub Actions workflow. Download the artifact named `jarvis-android-debug` from the run's **Artifacts** section. Debug APKs are development builds, not Play Store-signed releases.

