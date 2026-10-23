package com.viole.jarvis.agent

import android.content.Context
import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.ToolExecutionResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.Normalizer

/**
 * Small offline command path. It intentionally handles only deterministic,
 * local actions; it is not a substitute for an on-device language model.
 */
class LocalCommandRouter(
    private val context: Context,
    private val registry: AndroidToolRegistry
) {
    suspend fun run(input: String): AgentRunResult? = withContext(Dispatchers.Main) {
        val command = normalize(input)
        val result: ToolExecutionResult? = when {
            command.contains("notificac") || command.contains("mensagens recentes") ||
                command.contains("mensagens recebidas") || command == "ler mensagens" ->
                registry.get("read_notifications")?.execute(mapOf("limit" to 15))

            command.contains("ler tela") || command.contains("inspecionar tela") ||
                command.contains("o que aparece na tela") ->
                registry.get("read_screen")?.execute(emptyMap())

            command == "voltar" || command.startsWith("voltar para") ->
                registry.get("back")?.execute(emptyMap())

            command.contains("rolar para baixo") || command.contains("descer a tela") ->
                registry.get("scroll")?.execute(mapOf("direction" to "down"))

            command.contains("rolar para cima") || command.contains("subir a tela") ->
                registry.get("scroll")?.execute(mapOf("direction" to "up"))

            isOpenAppCommand(command) -> openApp(extractAppName(command))

            else -> null
        } ?: return@withContext null

        when (result) {
            is ToolExecutionResult.Success -> AgentRunResult.Completed(result.output)
            is ToolExecutionResult.Error -> AgentRunResult.Failed(result.message)
            is ToolExecutionResult.ConfirmationRequired -> AgentRunResult.Failed("A ação requer confirmação pelo fluxo normal do Jarvis.")
            null -> null
        }
    }

    private fun isOpenAppCommand(command: String): Boolean {
        val verbs = listOf("abrir ", "abre ", "abra ", "iniciar ", "inicia ", "inicie ", "executar ", "execute ", "entrar no ", "entrar na ", "abre o ", "abra o ", "abre a ", "abra a ")
        return verbs.any { command.startsWith(it) } &&
            listOf("whatsapp", "instagram", "telegram", "chrome", "navegador", "configuracoes", "youtube", "spotify")
                .any { command.contains(it) }
    }

    private fun extractAppName(command: String): String {
        val app = listOf("whatsapp", "instagram", "telegram", "chrome", "navegador", "configuracoes", "youtube", "spotify")
            .firstOrNull { command.contains(it) } ?: return command
        return app
    }

    private suspend fun openApp(name: String): ToolExecutionResult? {
        val packageName = when {
            name.contains("whatsapp") -> "com.whatsapp"
            name.contains("instagram") -> "com.instagram.android"
            name.contains("telegram") -> "org.telegram.messenger"
            name.contains("chrome") || name.contains("navegador") -> "com.android.chrome"
            name.contains("configura") -> "com.android.settings"
            name.contains("youtube") -> "com.google.android.youtube"
            name.contains("spotify") -> "com.spotify.music"
            else -> return ToolExecutionResult.Error(
                "Modo local: ainda não conheço o pacote do aplicativo '$name'. Abra-o manualmente ou configure o mapeamento."
            )
        }
        return registry.get("open_app")?.execute(mapOf("packageName" to packageName))
    }

    private fun normalize(value: String): String = Normalizer
        .normalize(value.lowercase().trim(), Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .replace(Regex("\\s+"), " ")
}
