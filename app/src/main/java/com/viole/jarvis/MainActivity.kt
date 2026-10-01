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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viole.jarvis.accessibility.JarvisAccessibilityService
import com.viole.jarvis.tools.AndroidTools

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            JarvisScreen(
                onOpenAccessibility = {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                }
            )
        }
    }
}

@Composable
private fun JarvisScreen(onOpenAccessibility: () -> Unit) {
    var screenText by remember { mutableStateOf("Nenhuma leitura realizada.") }

    MaterialTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("JARVIS", style = MaterialTheme.typography.headlineMedium)
                Text("Fundação Android — Fase 1")

                Button(onClick = onOpenAccessibility) {
                    Text("Abrir acessibilidade")
                }

                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = {
                        val nodes = AndroidTools.readScreen()
                        screenText = if (nodes.isEmpty()) {
                            "Nenhum elemento acessível encontrado."
                        } else {
                            nodes.take(80).joinToString("\n")
                        }
                    }
                ) {
                    Text("Ler tela")
                }

                Text(
                    text = if (JarvisAccessibilityService.instance != null) {
                        "Serviço: ativo"
                    } else {
                        "Serviço: inativo"
                    }
                )

                Text(screenText)
            }
        }
    }
}
