package com.viole.jarvis.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.text.Normalizer
import java.util.Locale

class VoiceTriggerService : Service() {
    companion object {
        const val ACTION_START = "com.viole.jarvis.voice.START"
        const val ACTION_STOP = "com.viole.jarvis.voice.STOP"
        const val ACTION_VOICE_COMMAND = "com.viole.jarvis.voice.COMMAND"
        const val EXTRA_COMMAND = "command"
        const val EXTRA_TRIGGER = "trigger"

        private const val CHANNEL_ID = "jarvis_voice"
        private const val NOTIFICATION_ID = 7001
        private const val WAKE_WINDOW_MS = 8_000L
        private const val CLAP_GAP_MS = 900L
        private const val CLAP_COOLDOWN_MS = 160L
        private const val CLAP_RMS_THRESHOLD = 8.5f
        private const val CLAP_BASELINE_THRESHOLD = 6.5f
    }

    private var recognizer: SpeechRecognizer? = null
    private var armedUntil = 0L
    private var lastRms = 0f
    private var firstClapAt = 0L
    private var lastClapAt = 0L
    private var restartScheduled = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        startRecognizer()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
        } else if (recognizer == null) {
            startRecognizer()
        }
        return START_STICKY
    }

    private fun startRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            broadcastStatus("Reconhecimento de voz indisponível.")
            return
        }

        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                restartScheduled = false
            }

            override fun onBeginningOfSpeech() = Unit

            override fun onRmsChanged(rmsdB: Float) {
                detectClap(rmsdB)
                lastRms = rmsdB
            }

            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit

            override fun onError(error: Int) {
                scheduleRestart()
            }

            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    .orEmpty()
                handleSpeech(text)
                scheduleRestart()
            }
        })

        startListening()
    }

    private fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }

        try {
            recognizer?.startListening(intent)
        } catch (_: Throwable) {
            scheduleRestart()
        }
    }

    private fun scheduleRestart() {
        if (restartScheduled) return
        restartScheduled = true
        android.os.Handler(mainLooper).postDelayed({
            restartScheduled = false
            startListening()
        }, 450L)
    }

    private fun handleSpeech(raw: String) {
        val normalized = normalize(raw)
        if (normalized.isBlank()) return

        val wakeIndex = normalized.indexOf("jarvis")
        if (wakeIndex >= 0) {
            val command = normalized
                .removeRange(wakeIndex, wakeIndex + "jarvis".length)
                .trim()

            armedUntil = System.currentTimeMillis() + WAKE_WINDOW_MS
            broadcastStatus("Wake word detectada.")

            if (command.isNotBlank()) {
                emitCommand(command, "wake_word")
                armedUntil = 0L
            }
            return
        }

        if (System.currentTimeMillis() <= armedUntil) {
            emitCommand(raw.trim(), "wake_word_followup")
            armedUntil = 0L
        }
    }

    private fun detectClap(rms: Float) {
        val now = System.currentTimeMillis()
        val risingPeak =
            rms >= CLAP_RMS_THRESHOLD && lastRms <= CLAP_BASELINE_THRESHOLD

        if (!risingPeak || now - lastClapAt < CLAP_COOLDOWN_MS) return

        lastClapAt = now

        if (firstClapAt != 0L && now - firstClapAt <= CLAP_GAP_MS) {
            firstClapAt = 0L
            armedUntil = now + WAKE_WINDOW_MS
            broadcastStatus("Duas palmas detectadas.")
        } else {
            firstClapAt = now
        }
    }

    private fun emitCommand(command: String, trigger: String) {
        sendBroadcast(Intent(ACTION_VOICE_COMMAND).apply {
            setPackage(packageName)
            putExtra(EXTRA_COMMAND, command)
            putExtra(EXTRA_TRIGGER, trigger)
        })
    }

    private fun broadcastStatus(status: String) {
        sendBroadcast(Intent(ACTION_VOICE_COMMAND).apply {
            setPackage(packageName)
            putExtra(EXTRA_COMMAND, "")
            putExtra(EXTRA_TRIGGER, status)
        })
    }

    private fun normalize(value: String): String =
        Normalizer.normalize(value.lowercase(Locale.ROOT), Normalizer.Form.NFD)
            .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
            .replace(Regex("[^a-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "Jarvis — ativação por voz",
                        NotificationManager.IMPORTANCE_LOW
                    )
                )
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("Jarvis ativo")
            .setContentText("Diga “Jarvis” ou bata duas palmas.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
