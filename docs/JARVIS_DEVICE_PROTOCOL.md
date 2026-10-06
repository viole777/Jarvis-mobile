# Jarvis Device Protocol

The Jarvis cloud brain is platform-agnostic. Devices are authenticated capability nodes.

## Lifecycle
1. registerDevice
2. authenticate
3. heartbeat
4. advertise capabilities
5. receive task
6. execute approved tool
7. report result
8. heartbeat until disconnect

## Device contract
A device exposes:
- deviceId
- platform
- appVersion
- status
- capabilities
- permissions
- lastSeen

## Core operations
- registerDevice()
- heartbeat()
- getCapabilities()
- executeTool()
- reportResult()
- cancelTask()

## Capability model
Capabilities describe what a device can technically do. They do not grant permission. Cloud policy, user authorization and device-side permission checks remain authoritative.

## Task routing
The cloud brain resolves required capabilities, filters authenticated/online devices, applies permissions and safety policy, then selects an appropriate device. A task can be resumed or rerouted when the original device becomes unavailable, provided the operation is safe and idempotent.

## Transport
The protocol is transport-agnostic. WebSocket is the preferred future transport for realtime task delivery and events; HTTPS remains suitable for registration and management APIs.

## Security
Device credentials are never exposed to the model. Registration credentials/tokens are stored outside prompts. Every execution is authorized independently.

## Initial implementations
- Android Agent: Android APIs, accessibility, microphone, notifications and apps.
- Windows Agent: filesystem, terminal, Git, browser and development tooling.
- Web client: conversation/UI only; it is not automatically trusted as an execution device.
