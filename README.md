# Jarvis Mobile

Assistente pessoal experimental para Android, inspirado na arquitetura de agentes como Claude Code.

## Fase 1

O projeto começa pelo "corpo" do agente:

- Android nativo com Kotlin;
- Accessibility Service;
- leitura da árvore de acessibilidade;
- camada inicial de ferramentas;
- tela de diagnóstico para ativar e testar o serviço.

## Arquitetura planejada

Android App -> Tool Layer -> Agent -> LLM

As ações sensíveis devem exigir confirmação explícita do usuário.

## Como abrir

1. Clone o repositório.
2. Abra no Android Studio.
3. Aguarde o Gradle Sync.
4. Execute em um dispositivo Android.
5. Abra "Acessibilidade" pelo botão do app e ative o Jarvis manualmente.

> O Accessibility Service é uma capacidade poderosa e deve ser usado somente com autorização explícita do usuário.
