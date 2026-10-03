package com.viole.jarvis

import android.content.Context
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.viole.jarvis.accessibility.JarvisAccessibilityService
import com.viole.jarvis.agent.AgentLoop
import com.viole.jarvis.agent.AgentRunResult
import com.viole.jarvis.agent.HttpModelClient
import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.AndroidTools
import com.viole.jarvis.voice.VoiceTriggerService
import kotlinx.coroutines.launch

private const val PREFS = "jarvis_settings"
private const val URL_KEY = "backend_url"
private const val TOKEN_KEY = "backend_token"
private const val DEFAULT_URL = "http://10.0.2.2:3000"
private const val AUDIO_PERMISSION_REQUEST = 9001

class MainActivity : ComponentActivity() {
    private lateinit var agent: AgentLoop
    private var voiceReceiver: BroadcastReceiver? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        var backendUrl = prefs.getString(URL_KEY, DEFAULT_URL) ?: DEFAULT_URL
        var backendToken = prefs.getString(TOKEN_KEY, "") ?: ""

        fun configureAgent() {
            agent = AgentLoop(
                model = HttpModelClient(backendUrl, backendToken),
                registry = AndroidToolRegistry(applicationContext)
            )
        }

        configureAgent()

        voiceReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val command = intent?.getStringExtra(VoiceTriggerService.EXTRA_COMMAND).orEmpty()
                if (command.isBlank()) return
                lifecycleScope.launch {
                    agent.run(command)
                }
            }
        }
        registerVoiceReceiver()
        ensureVoiceTriggerPermission()

        setContent {
            JarvisScreen(
                initialUrl = backendUrl,
                initialToken = backendToken,
                onOpenAccessibility = {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                },
                onSaveBackend = { url, token ->
                    backendUrl = url.trim()
                    backendToken = token
                    prefs.edit()
                        .putString(URL_KEY, backendUrl)
                        .putString(TOKEN_KEY, backendToken)
                        .apply()
                    configureAgent()
                },
                onRunAgent = { input, onResult ->
                    lifecycleScope.launch {
                        onResult(agent.run(input))
                    }
                },
                onConfirm = { approved, onResult ->
                    lifecycleScope.launch {
                        onResult(agent.confirmPending(approved))
                    }
                }
            )
        }
    }

    private fun registerVoiceReceiver() {
        val receiver = voiceReceiver ?: return
        val filter = IntentFilter(VoiceTriggerService.ACTION_VOICE_COMMAND)
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(receiver, filter)
        }
    }

    private fun ensureVoiceTriggerPermission() {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                arrayOf(android.Manifest.permission.RECORD_AUDIO),
                AUDIO_PERMISSION_REQUEST
            )
        } else {
            startVoiceTriggerService()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == AUDIO_PERMISSION_REQUEST &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
        ) {
            startVoiceTriggerService()
        }
    }

    private fun startVoiceTriggerService() {
        val intent = Intent(this, VoiceTriggerService::class.java).apply {
            action = VoiceTriggerService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= 26) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onDestroy() {
        voiceReceiver?.let {
            try { unregisterReceiver(it) } catch (_: IllegalArgumentException) {}
        }
        voiceReceiver = null
        super.onDestroy()
    }

}

@Composable
private fun JarvisScreen(
    initialUrl: String,
    initialToken: String,
    onOpenAccessibility: () -> Unit,
    onSaveBackend: (String, String) -> Unit,
    onRunAgent: (String, (AgentRunResult) -> Unit) -> Unit,
    onConfirm: (Boolean, (AgentRunResult) -> Unit) -> Unit
) {
    var command by remember { mutableStateOf("") }
    var backendUrl by remember { mutableStateOf(initialUrl) }
    var backendToken by remember { mutableStateOf(initialToken) }
    var response by remember { mutableStateOf("Aguardando comando.") }
    var screenText by remember { mutableStateOf("Nenhuma leitura realizada.") }
    var status by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf<AgentRunResult.NeedsConfirmation?>(null) }

    fun handleResult(result: AgentRunResult) {
        when (result) {
            is AgentRunResult.Completed -> {
                response = result.text
                status = "Tarefa concluída."
                confirmation = null
            }
            is AgentRunResult.Failed -> {
                response = result.message
                status = "Tarefa interrompida."
                confirmation = null
            }
            is AgentRunResult.NeedsConfirmation -> {
                response = "Aguardando sua confirmação."
                status = "Safety Engine pausou a execução."
                confirmation = result
            }
        }
    }

    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            Column(
                Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("JARVIS", style = MaterialTheme.typography.headlineMedium)
                Text("Agent + Orchestration + Safety Engine")

                Button(onClick = onOpenAccessibility) {
                    Text("Abrir acessibilidade")
                }

                Text(
                    if (JarvisAccessibilityService.instance != null) "Serviço: ativo"
                    else "Serviço: inativo"
                )

                OutlinedTextField(
                    value = backendUrl,
                    onValueChange = { backendUrl = it },
                    label = { Text("URL do backend") }
                )

                OutlinedTextField(
                    value = backendToken,
                    onValueChange = { backendToken = it },
                    label = { Text("Token do backend") }
                )

                Button(
                    onClick = {
                        onSaveBackend(backendUrl, backendToken)
                        status = "Configuração salva."
                    }
                ) {
                    Text("Salvar backend")
                }

                OutlinedTextField(
                    value = command,
                    onValueChange = { command = it },
                    label = { Text("Comando") }
                )

                Button(
                    enabled = command.isNotBlank() &&
                        backendToken.isNotBlank() &&
                        JarvisAccessibilityService.instance != null,
                    onClick = {
                        response = "Planejando e executando..."
                        status = "Agent Loop ativo."
                        onRunAgent(command) { handleResult(it) }
                    }
                ) {
                    Text("Executar com Jarvis")
                }

                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = {
                        screenText = AndroidTools.readScreen()
                            .take(80)
                            .joinToString("\n")
                            .ifBlank { "Nenhum elemento acessível encontrado." }
                    }
                ) {
                    Text("Ler tela")
                }

                Text("Resposta: " + response)
                Text(status)
                Text(screenText)
            }
        }
    }

    confirmation?.let { pending ->
        AlertDialog(
            onDismissRequest = {
                onConfirm(false) { handleResult(it) }
            },
            title = { Text("Confirmação necessária") },
            text = {
                Text(
                    pending.reason +
                        "\n\nFerramenta: " + pending.toolName +
                        "\nArgumentos: " + pending.arguments
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        confirmation = null
                        onConfirm(true) { handleResult(it) }
                    }
                ) {
                    Text("Permitir")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        confirmation = null
                        onConfirm(false) { handleResult(it) }
                    }
                ) {
                    Text("Recusar")
                }
            }
        )
    }
}