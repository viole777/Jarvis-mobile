package com.viole.jarvis

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.viole.jarvis.accessibility.JarvisAccessibilityService
import com.viole.jarvis.tools.AndroidTools

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { JarvisScreen { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) } }
    }
}

@Composable
private fun JarvisScreen(onOpenAccessibility: () -> Unit) {
    var screenText by remember { mutableStateOf("Nenhuma leitura realizada.") }
    var status by remember { mutableStateOf("") }
    MaterialTheme {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("JARVIS", style = MaterialTheme.typography.headlineMedium)
                Text("Fundação Android — Fase 1")
                Button(onClick = onOpenAccessibility) { Text("Abrir acessibilidade") }
                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = { screenText = AndroidTools.readScreen().take(80).joinToString("\n").ifBlank { "Nenhum elemento acessível encontrado." } }
                ) { Text("Ler tela") }
                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = { status = AndroidTools.back().fold({ "Back: executado" }, { "Back: \${it.message}" }) }
                ) { Text("Voltar") }
                Button(
                    enabled = JarvisAccessibilityService.instance != null,
                    onClick = { status = AndroidTools.scroll(AndroidTools.ScrollDirection.DOWN).fold({ "Scroll: executado" }, { "Scroll: \${it.message}" }) }
                ) { Text("Rolar para baixo") }
                Text(if (JarvisAccessibilityService.instance != null) "Serviço: ativo" else "Serviço: inativo")
                Text(status)
                Text(screenText)
            }
        }
    }
}
