---
name: tribunal
description: |
  Use when the user says "/tribunal", "tribunal", "review this",
  "3-way review", or asks for risk-value-feasibility analysis.
allowed-tools:
  - github_read_repository
  - github_read_file
  - github_prepare_edit
  - github_confirm_edit
  - parallel_review
validate_prompt: |
  Must contain:
  1. Three parallel reviewer roles: codex-risk-analyst, value-assessor, feasibility-checker
  2. A Tribunal Verdict section with scores table and final verdict
  3. Required Actions if verdict is REVISE or REJECT
---

# /tribunal — revisão adversarial em 3 perspectivas

## Objetivo
Avaliar uma proposta, diff, PR ou arquivo por risco, valor e viabilidade. Seja crítico, cite evidências do material recebido e não invente testes ou fatos.

## Entrada
- Arquivo ou caminho: leia o arquivo e, quando necessário, contexto relacionado.
- PR: obtenha título, descrição e diff antes de avaliar.
- Diff: use o diff fornecido ou solicite-o ao usuário.
- Sem alvo: pergunte o que deve ser revisado.
- Se o alvo envolver edição de repositório, inspecione primeiro o estado atual; nunca substitua arquivos com base apenas em suposições.

## Revisores em paralelo
Lance simultaneamente três revisões independentes, com o mesmo conteúdo e contexto:

1. **codex-risk-analyst** — perspectiva adversarial: vulnerabilidades, regressões, privacidade, segurança, dependências e falhas críticas. Rating obrigatório: BLOCK, CAUTION ou CLEAR.
2. **value-assessor** — perspectiva construtiva: resultado entregue, alinhamento com o objetivo, impacto, alternativas e pontos fortes que devem ser preservados. Rating obrigatório: STRONG, ADEQUATE ou WEAK.
3. **feasibility-checker** — perspectiva pragmática: arquitetura, dependências, esforço, testes, integração, implantação e bloqueios reais. Rating obrigatório: GO, CONDITIONAL ou NO-GO.

No runtime Cloudflare do Jarvis, estes são três papéis de revisão executados em paralelo pelo modelo configurado, não agentes Codex/Claude reais. Nunca afirme que serviços externos foram usados se não foram.

## Síntese
Produza:

### Tribunal Verdict
| Dimension | Agent | Rating | Key Finding |
|---|---|---|---|
| Risk | codex-risk-analyst | BLOCK/CAUTION/CLEAR | achado resumido |
| Value | value-assessor | STRONG/ADEQUATE/WEAK | benefício resumido |
| Feasibility | feasibility-checker | GO/CONDITIONAL/NO-GO | viabilidade resumida |

### Verdict: APPROVE / REVISE / REJECT
- APPROVE: CLEAR+STRONG/ADEQUATE+GO; CAUTION+STRONG+GO pode ser aprovado com ressalvas.
- REVISE: riscos BLOCK, valor WEAK, combinações condicionais ou problemas corrigíveis.
- REJECT: NO-GO sem alternativa razoável, ou riscos críticos que tornem a proposta inaceitável.
- Use julgamento documentado em combinações não listadas.

Inclua **Contention Points**, **Required Actions**, e **Strengths to Preserve**. Se REVISE ou REJECT, separe:
- Must Fix
- Should Address
- Consider

Inclua os três relatórios completos em seções recolhíveis quando a interface suportar; caso contrário, use subtítulos simples.

## Segurança e integridade
- Não execute nem grave alterações só porque uma revisão recomendou isso.
- Antes de editar GitHub, leia a versão atual e prepare um diff. Peça confirmação explícita antes de criar commit, abrir PR ou alterar arquivos.
- Nunca mostre tokens, segredos ou conteúdo de credenciais.
- Distinga fatos verificados, inferências e perguntas em aberto.
- Não diga que testes passaram sem executá-los.
