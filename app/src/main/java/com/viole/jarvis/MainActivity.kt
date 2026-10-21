package com.viole.jarvis

import android.content.Context
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
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
private const val DEFAULT_URL = "https://jarvis-v2-cloud.viole-jarvis.workers.dev"
private const val AUDIO_PERMISSION_REQUEST = 9001

private val Ink = Color(0xFF050B14)
private val Panel = Color(0xFF0B1726)
private val Cyan = Color(0xFF48E7F2)
private val Blue = Color(0xFF4D91FF)
private val Muted = Color(0xFF9FB5C8)

class MainActivity : ComponentActivity() {
    private lateinit var agent: AgentLoop
    private var voiceReceiver: BroadcastReceiver? = null
    private var voiceCommandHandler: ((String) -> Unit)? = null
    private var voiceListening by mutableStateOf(false)
    private var microphonePermission by mutableStateOf(false)
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        microphonePermission = checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        tts = TextToSpeech(this) { result ->
            if (result == TextToSpeech.SUCCESS) {
                ttsReady = tts?.setLanguage(Locale("pt", "BR")) != TextToSpeech.LANG_MISSING_DATA &&
                    tts?.setLanguage(Locale("pt", "BR")) != TextToSpeech.LANG_NOT_SUPPORTED
                tts?.setSpeechRate(0.92f)
                tts?.setPitch(0.82f)
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) = Unit
                    override fun onError(utteranceId: String?) = Unit
                    override fun onDone(utteranceId: String?) {
                        runOnUiThread { if (voiceListening && microphonePermission) startVoiceTriggerService() }
                    }
                })
            }
        }

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
                if (command.isNotBlank()) {\n                    if (voiceListening) stopService(Intent(this@MainActivity, VoiceTriggerService::class.java))\n                    voiceCommandHandler?.invoke(command)\n                }
            }
        }
        registerVoiceReceiver()

        setContent {
            JarvisScreen(
                initialUrl = backendUrl,
                initialToken = backendToken,
                voiceListening = voiceListening,
                microphonePermission = microphonePermission,
                onOpenAccessibility = { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) },
                onRequestMicrophone = {
                    if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), AUDIO_PERMISSION_REQUEST)
                    } else microphonePermission = true
                },
                onVoiceToggle = { enabled ->
                    if (enabled && microphonePermission) startVoiceTriggerService()
                    else stopVoiceTriggerService()
                },
                onSetVoiceCommandHandler = { handler -> voiceCommandHandler = handler },
                onSpeakResponse = { text -> speakResponse(text) },
                onSaveBackend = { url, token ->
                    backendUrl = url.trim()
                    backendToken = token
                    prefs.edit().putString(URL_KEY, backendUrl).putString(TOKEN_KEY, backendToken).apply()
                    configureAgent()
                },
                onRunAgent = { input, onResult -> lifecycleScope.launch { onResult(agent.run(input)) } },
                onConfirm = { approved, onResult -> lifecycleScope.launch { onResult(agent.confirmPending(approved)) } }
            )
        }
    }

    private fun registerVoiceReceiver() {
        val receiver = voiceReceiver ?: return
        val filter = IntentFilter(VoiceTriggerService.ACTION_VOICE_COMMAND)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        else registerReceiver(receiver, filter)
    }

    private fun startVoiceTriggerService() {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            microphonePermission = false
            return
        }
        val intent = Intent(this, VoiceTriggerService::class.java).apply { action = VoiceTriggerService.ACTION_START }
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
        voiceListening = true
    }

    private fun stopVoiceTriggerService() {
        stopService(Intent(this, VoiceTriggerService::class.java))
        voiceListening = false
        tts?.stop()
    }

    private fun speakResponse(text: String) {
        if (!voiceListening || !ttsReady || text.isBlank()) return
        stopService(Intent(this, VoiceTriggerService::class.java))
        tts?.speak(text.take(3000), TextToSpeech.QUEUE_FLUSH, null, "jarvis-response-" + System.currentTimeMillis())
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == AUDIO_PERMISSION_REQUEST) {
            microphonePermission = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
            if (!microphonePermission) voiceListening = false
        }
    }

    override fun onDestroy() {
        voiceReceiver?.let { try { unregisterReceiver(it) } catch (_: IllegalArgumentException) {} }
        voiceReceiver = null
        voiceCommandHandler = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}

@Composable
private fun JarvisScreen(
    initialUrl: String,
    initialToken: String,
    voiceListening: Boolean,
    microphonePermission: Boolean,
    onOpenAccessibility: () -> Unit,
    onRequestMicrophone: () -> Unit,
    onVoiceToggle: (Boolean) -> Unit,
    onSetVoiceCommandHandler: (((String) -> Unit)?) -> Unit,
    onSpeakResponse: (String) -> Unit,
    onSaveBackend: (String, String) -> Unit,
    onRunAgent: (String, (AgentRunResult) -> Unit) -> Unit,
    onConfirm: (Boolean, (AgentRunResult) -> Unit) -> Unit
) {
    var command by remember { mutableStateOf("") }
    var backendUrl by remember { mutableStateOf(initialUrl) }
    var backendToken by remember { mutableStateOf(initialToken) }
    var response by remember { mutableStateOf("Pronto para receber ordens.") }
    var screenText by remember { mutableStateOf("Nenhuma leitura realizada.") }
    var status by remember { mutableStateOf("Sistema em espera.") }
    var busy by remember { mutableStateOf(false) }
    var confirmation by remember { mutableStateOf<AgentRunResult.NeedsConfirmation?>(null) }

    fun handleResult(result: AgentRunResult) {
        busy = false
        when (result) {
            is AgentRunResult.Completed -> { response = result.text; status = "Execução finalizada."; confirmation = null; onSpeakResponse(result.text) }
            is AgentRunResult.Failed -> { response = result.message; status = "Execução interrompida."; confirmation = null; onSpeakResponse(result.message) }
            is AgentRunResult.NeedsConfirmation -> {
                response = "Aguardando sua autorização."
                status = "A Safety Engine pausou a ação."
                confirmation = result
                onSpeakResponse("Preciso da sua autorização para continuar. " + result.reason)
            }
        }
    }

    DisposableEffect(Unit) {
        onSetVoiceCommandHandler { input ->
            command = input
            busy = true
            response = "Entendi: $input"
            status = "Comando recebido por voz."
            onRunAgent(input) { handleResult(it) }
        }
        onDispose { onSetVoiceCommandHandler(null) }
    }

    MaterialTheme {
        Surface(Modifier.fillMaxSize(), color = Ink) {
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Column {
                        Text("J.A.R.V.I.S.", color = Cyan, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text("PERSONAL INTELLIGENCE SYSTEM", color = Muted, style = MaterialTheme.typography.labelSmall)
                    }
                    Box(Modifier.clip(CircleShape).background(if (voiceListening) Color(0xFF10353D) else Panel).border(1.dp, if (voiceListening) Cyan else Muted.copy(alpha = .35f), CircleShape).padding(horizontal = 12.dp, vertical = 8.dp)) {
                        Text(if (voiceListening) "VOICE ACTIVE" else "STANDBY", color = if (voiceListening) Cyan else Muted, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                    }
                }

                CoreOrb(active = voiceListening || busy)

                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brush.verticalGradient(listOf(Panel, Color(0xFF08111D)))).border(1.dp, Cyan.copy(alpha = .18f), RoundedCornerShape(20.dp)).padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(if (busy) "PROCESSANDO SOLICITAÇÃO" else if (voiceListening) "À ESCUTA" else "SISTEMA PRONTO", color = Cyan, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                    Text(response, color = Color(0xFFE8F4FF), style = MaterialTheme.typography.bodyLarge)
                    Text(status, color = Muted, style = MaterialTheme.typography.bodySmall)
                }

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Button(
                        modifier = Modifier.weight(1f),
                        onClick = {
                            if (voiceListening) onVoiceToggle(false)
                            else if (microphonePermission) onVoiceToggle(true) else onRequestMicrophone()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = if (voiceListening) Color(0xFF7A2635) else Color(0xFF0D6574))
                    ) { Text(if (voiceListening) "Desativar voz" else if (microphonePermission) "Ativar voz contínua" else "Permitir microfone") }
                    Button(
                        modifier = Modifier.weight(1f),
                        onClick = onOpenAccessibility,
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF17314B))
                    ) { Text(if (JarvisAccessibilityService.instance != null) "Acessibilidade ativa" else "Ativar controle") }
                }

                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Panel).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("COMANDO", color = Cyan, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                    OutlinedTextField(value = command, onValueChange = { command = it }, label = { Text("O que devo fazer?") }, modifier = Modifier.fillMaxWidth(), enabled = !busy)
                    Button(
                        enabled = command.isNotBlank() && backendToken.isNotBlank() && !busy && JarvisAccessibilityService.instance != null,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            busy = true
                            response = "Planejando etapas e verificando permissões..."
                            status = "Agent Loop ativo."
                            onRunAgent(command) { handleResult(it) }
                        }
                    ) { Text("Executar com segurança") }
                    Button(
                        enabled = JarvisAccessibilityService.instance != null && !busy,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF17314B)),
                        onClick = {
                            screenText = AndroidTools.readScreen().take(80).joinToString("\n").ifBlank { "Nenhum elemento acessível encontrado." }
                        }
                    ) { Text("Inspecionar tela atual") }
                    if (screenText != "Nenhuma leitura realizada.") Text(screenText, color = Muted, style = MaterialTheme.typography.bodySmall)
                }

                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Panel).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("CONEXÃO SEGURA", color = Cyan, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                    OutlinedTextField(value = backendUrl, onValueChange = { backendUrl = it }, label = { Text("URL do backend") }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = backendToken, onValueChange = { backendToken = it }, label = { Text("Token de acesso") }, modifier = Modifier.fillMaxWidth())
                    Button(onClick = { onSaveBackend(backendUrl, backendToken); status = "Configuração salva localmente." }, modifier = Modifier.fillMaxWidth()) { Text("Salvar conexão") }
                    Text("O token fica armazenado no dispositivo e é enviado somente ao backend configurado.", color = Muted, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }

    confirmation?.let { pending ->
        AlertDialog(
            onDismissRequest = { onConfirm(false) { handleResult(it) } },
            title = { Text("Confirmação necessária") },
            text = { Text(pending.reason + "\n\nFerramenta: " + pending.toolName + "\nArgumentos: " + pending.arguments) },
            confirmButton = {
                Button(onClick = { confirmation = null; onConfirm(true) { handleResult(it) } }) { Text("Permitir") }
            },
            dismissButton = {
                TextButton(onClick = { confirmation = null; onConfirm(false) { handleResult(it) } }) { Text("Recusar") }
            }
        )
    }
}

@Composable
private fun CoreOrb(active: Boolean) {
    val transition = rememberInfiniteTransition(label = "jarvis-core")
    val pulse by transition.animateFloat(
        initialValue = 0.90f,
        targetValue = 1.06f,
        animationSpec = infiniteRepeatable(animation = tween(durationMillis = if (active) 1100 else 2300), repeatMode = RepeatMode.Reverse),
        label = "core-pulse"
    )
    Box(Modifier.fillMaxWidth().height(218.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(208.dp)) {
            val center = this.center
            val base = size.minDimension / 2f
            drawCircle(Cyan.copy(alpha = .08f), radius = base * pulse)
            drawCircle(Cyan.copy(alpha = .18f), radius = base * .86f, style = Stroke(width = 1.5.dp.toPx()))
            drawCircle(Blue.copy(alpha = .38f), radius = base * .72f, style = Stroke(width = 2.dp.toPx()))
            drawCircle(Cyan.copy(alpha = .12f), radius = base * .55f)
            drawCircle(Brush.radialGradient(listOf(Color(0xFFB7FFFF), Cyan, Color(0xFF086E91), Color(0xFF04111F)), center = center, radius = base * .54f), radius = base * .52f)
            drawCircle(Color.White.copy(alpha = .8f), radius = base * .07f)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("J", color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Light)
            Text(if (active) "ACTIVE" else "ONLINE", color = Color.White.copy(alpha = .82f), style = MaterialTheme.typography.labelSmall)
        }
    }
}
