# Voice recognition in Jarvis Android

## Current implementation verified

- `VoiceTriggerService` uses Android `SpeechRecognizer` and requests Brazilian Portuguese (`pt-BR`).
- It runs as a foreground microphone service after the user activates voice mode.
- It listens for the wake word "Jarvis", then broadcasts the recognized command to `MainActivity`.
- `MainActivity` forwards the command to the same `AgentLoop` used by text input and speaks the response with Android TextToSpeech.

## Important distinction

Speech recognition (turning audio into words) is not speaker identification (proving that the speaker is Luiz). The current implementation does **not** verify a speaker's identity. ChatGPT receiving audio in this conversation does not expose the raw audio or a reusable voiceprint to the Jarvis Android app.

Do not treat a transcript or the wake word as authentication. Any sensitive action must use the app's own explicit authorization flow. Voice biometrics, if added later, need a separate opt-in enrollment flow, local secure storage, liveness/false-accept testing, and a fallback method; a voice match alone should not authorize irreversible actions.

## Device validation checklist

1. Grant microphone permission and activate voice mode; verify the foreground notification appears.
2. Say "Jarvis, abra o WhatsApp"; verify exactly one command is dispatched and the app opens at most once.
3. Say "Jarvis" and then give a command within the wake window; verify it is dispatched once.
4. Speak Portuguese without the wake word while disarmed; verify it does not execute a command.
5. Deny microphone permission; verify no microphone service starts and the UI explains why.
6. Disable or remove the system speech recognition service; verify the app reports recognition unavailable rather than pretending to have heard a command.
7. Test noise, silence, repeated partial/final results, screen lock, app backgrounding, and returning from TTS; verify there are no duplicate executions or endless restart loops.
8. Verify text and voice use the same conversation context and that the spoken response matches the displayed response.
9. Verify sensitive actions stop for the app's explicit authorization flow; never infer approval from the recognized words alone.
10. Run the Android build and install the resulting APK on a real device before claiming the feature is validated.

## Known limitations

- Recognition quality and availability depend on the Android device and its configured speech-recognition provider; the app does not currently ship its own offline speech model.
- Wake-word detection is based on the recognized transcript, not a dedicated always-on acoustic wake-word model.
- No speaker-verification model or enrolled voice profile exists in this implementation.
