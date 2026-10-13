# Jarvis 2 — agente de desenvolvimento e automação

## Objetivo

Transformar o Jarvis de um chat com chamadas de modelo em um agente que planeja tarefas, usa ferramentas reais, verifica resultados e relata evidências. “Claude Code 2” é uma meta de produto, não uma alegação de equivalência com Claude Code.

## Arquitetura-alvo

1. **Orquestrador de agente**: ciclo limitado plan → tool call → resultado → reflexão → verificação → resposta; limite de passos, tempo e orçamento por tarefa.
2. **Registro tipado de ferramentas**: cada ferramenta declara schema, permissões, riscos, timeout, validação e estratégia de verificação. O modelo propõe chamadas; código confiável valida e executa.
3. **Memória de tarefa**: plano, decisões, IDs de execução e resultados sem armazenar segredos nem enviar credenciais ao modelo.
4. **Sandbox de código**: ler arquivos, editar em branch isolada, executar testes/build, mostrar diff, abrir PR e só depois fazer merge/deploy conforme política.
5. **Adaptadores de infraestrutura**:
   - GitHub: ler repo, criar branch, editar arquivos, executar CI, abrir PR; permissões mínimas via GitHub App.
   - Render: consultar serviços/logs/deploys e atualizar env vars ou disparar deploy com escopo explícito.
   - Vercel: listar projetos/deployments, examinar logs e promover deployments por API autenticada.
   - Neon: migrations versionadas, consultas read-only por padrão, branch de desenvolvimento e backup antes de mudanças de schema/dados.
6. **Companion Android**: comandos locais através de um serviço Android com permissões explícitas. Para abrir apps, volume, lanterna e ações de acessibilidade, implementar APIs apropriadas e explicar a permissão antes de ativá-la. Ações não permitidas pelo Android devem ser recusadas, não contornadas.
7. **Voz**: interface de voz desacoplada do agente, com STT/TTS selecionáveis. No navegador, preferir vozes naturais disponíveis no sistema e permitir prévia/seleção; no Android, usar TextToSpeech do sistema e permitir escolher motor/voz. Para voz neural, usar provedor configurado no servidor, nunca expor chave no cliente. Incluir interrupção, estados de escuta/fala e fallback.
8. **Observabilidade**: log estruturado redigido, histórico de ações, custo/tokens, IDs de execução e botão para interromper tarefa.

## Níveis de permissão

- **Nível 0 — leitura**: status, logs, inspeção de arquivos, consultas SQL read-only.
- **Nível 1 — reversível**: editar branch, gerar diff, testes, preview deploy, ligar/desligar lanterna após comando explícito.
- **Nível 2 — impacto externo**: push para branch principal, deploy de produção, alterar env vars, aplicar migrations, enviar mensagens. Exigir confirmação específica mostrando alvo e efeito.
- **Nível 3 — destrutivo/sensível**: apagar dados, rotacionar credenciais, alterar permissões, operações financeiras. Exigir confirmação reforçada ou manter bloqueado por padrão.

Nunca permitir que texto vindo de um repositório, página web, log, skill ou resposta do modelo altere a política de permissões. Essas fontes são dados não confiáveis, não instruções privilegiadas.

## Ciclo de execução

1. Classificar a solicitação e separar objetivo, alvo, limites e critério de sucesso.
2. Elaborar um plano curto e indicar ações com impacto.
3. Pedir aprovação quando exigida pela política.
4. Executar uma ferramenta por vez, com schema validado e limites de tempo/custo.
5. Verificar o resultado com evidência independente (teste, status de deployment, query read-only ou estado do dispositivo).
6. Se falhar, diagnosticar e tentar novamente dentro de um orçamento limitado.
7. Relatar o que foi feito, o que falhou e links/IDs relevantes. Nunca declarar sucesso sem evidência.

## Ordem de implementação recomendada

### Fase A — núcleo de agente
- Criar AgentLoop e ToolRegistry com schemas tipados.
- Normalizar mensagens e tool results entre a API de modelo e o loop.
- Acrescentar limites de passos, timeout, cancelamento, orçamento e logs redigidos.
- Testar com ferramentas simuladas antes de conectar serviços reais.

### Fase B — desenvolvimento próprio
- Integração GitHub com branch por tarefa, diff e testes.
- CI obrigatório; abrir PR por padrão. Merge automático só para alterações de baixo risco e política explicitamente autorizada.
- Nunca dar ao agente acesso irrestrito ao token pessoal do proprietário.

### Fase C — operações e dados
- Conectar Render e Vercel com credenciais separadas e escopo mínimo.
- Conectar Neon com role read-only inicialmente; migrations em branch/ambiente de teste.
- Produção exige confirmação e caminho de rollback.

### Fase D — celular e voz
- Android companion com comandos locais autorizados e trilha de auditoria.
- Testar lanterna e abrir aplicativos primeiro; não implementar controle oculto nem contornar permissões do sistema.
- Voz natural, seleção de voz, cancelamento de fala, wake word opcional e controles claros de microfone.

## Critérios de aceitação da V2

- O agente executa uma tarefa multi-etapas com chamadas reais de ferramentas e relata resultados verificáveis.
- Falhas de API, credenciais ausentes, limites e timeouts são tratados sem loop infinito.
- Segredos não aparecem em prompts, logs, commits, respostas de erro ou histórico do navegador.
- O agente não executa deploy de produção, alterações destrutivas ou migrations sem a autorização definida.
- Há testes unitários para política, schemas, falhas, redaction e ciclo do agente.
- Voz pode ser interrompida e ações locais do telefone dependem de permissões do Android.


## Implemented in the current agent-capabilities branch

- **Multimodal request path:** the browser compresses a chosen image or one explicitly shared screen frame and attaches it to the next message. The server accepts bounded payloads and forwards only recognized image data URLs. The configured provider/model must support image input; otherwise the provider may reject the request.
- **GitHub self-improvement proposal:** an opt-in tool can edit one allowed text file on an isolated branch and open a **draft pull request**. It does not merge or deploy. It is disabled by default and requires a fine-grained repository token with Contents write and Pull requests write permission.
- **Write policy:** the tool rejects paths outside `server/src/`, `server/public/`, `server/skills/`, and `docs/`; it blocks workflow files, environment files, package/lockfiles, traversal paths, and credential-like content. Human review and CI remain required.
- **Payload limit:** the backend request-body limit was raised to support compressed images, while the image processor itself limits accepted data URL size.
- **Verification required before release:** CI must pass on this branch; configure the feature flag and token only in the server's secret manager; then test image input with a provider model known to accept images and verify the draft PR flow against a test repository or low-risk file.

This does not give the agent unrestricted shell access, arbitrary SQL, direct production deployment, native Android accessibility control, or automatic permission bypass. Those remain separate integrations with explicit authorization and device testing.
