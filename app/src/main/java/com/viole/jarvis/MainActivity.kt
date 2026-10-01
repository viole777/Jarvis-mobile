package com.viole.jarvis

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.viole.jarvis.accessibility.JarvisAccessibilityService
import com.viole.jarvis.agent.AgentLoop
import com.viole.jarvis.agent.MockModelClient
import com.viole.jarvis.tools.AndroidToolRegistry
import com.viole.jarvis.tools.AndroidTools
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var agent: AgentLoop

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        agent = AgentLoop(
            model = MockModelClient(),
            registry = AndroidToolRegistry(applicationContext)
        )

        setContent {
            JarvisScreen(
                onOpenAccessibility = {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                },
                onRunAgent = { input, onResult ->
                    lifecycleScope.launch {
                        onResult(agent.run(input))
                    }
                }
            )
        }
    }
}

@Composable
private fun JarvisScreen(
    onOpenAccessibility: () -> Unit,
    onRunAgent: (String, (String) -> Unit) -> Unit
) {
    var command by remember { mutableStateOf("") }
    var response by remember { mutableStateOf("Aguardando comando.") }
    var screenText by remember { mutableStateOf("Nenhuma leitura realizada.") }
    var status by remember { mutableStateOf("") }

    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            Column(
                Modifier.fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("JARVIS", style = MaterialTheme.typography.headlineMedium)
                Text("Agent Loop — Fase 2")

                Button(onClick = onOpenAccessibility) {
                    Text("Abrir acessibilidade")
                }

                Text(
                    if (JarvisAccessibilityService.instance != null)
                        "Serviço: ativo"
                    else
                        "Serviço: inativo"
                )

                OutlinedTextField(
                    value = command,
                    onValueChange = { command = it },
                    label = { Text("Comando") },
                    modifier = Modifier.fillMaxSize().weight(1f, false)
                )

                Button(
                    enabled = command.isNotBlank() && JarvisAccessibilityService.instance != null,
                    onClick = {
                        val input = command
                        response = "Executando..."
                        onRunAgent(input) { response = it }
                    }
                ) {
                    Text("Executar")
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

                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = {
                        status = AndroidTools.back()
                            .fold({ "Back: executado" }, { "Back: " + it.message })
                    }
                ) {
                    Text("Voltar")
                }

                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = {
                        status = AndroidTools.scroll(AndroidTools.ScrollDirection.DOWN)
                            .fold({ "Scroll: executado" }, { "Scroll: " + it.message })
                    }
                ) {
                    Text("Rolar para baixo")
                }

                Text("Resposta: " + response)
                Text(status)
                Text(screenText)
            }
        }
    }
}
