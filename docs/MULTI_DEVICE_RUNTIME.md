# Jarvis Multi-Device Runtime

Jarvis has one cloud identity and cognitive runtime, while phones, PCs, notebooks and tablets act as capability-bearing devices.

## Principles
- The brain reasons about capabilities, not operating systems.
- A device advertises capabilities, status, permissions and availability.
- The cloud selects a suitable device through a Device Registry and Device Router.
- A task may begin on one device and execute on another.
- Results return to the conversation device.
- Device availability is checked before execution.
- Permissions remain enforced by the device agent and cloud safety layer.

## Conceptual flow
User -> Cloud Brain -> Capability Resolver -> Device Router -> Device Agent -> Observation -> Validator -> Cloud Brain -> User

## Device model
Each device has an id, owner/session binding, platform, capabilities, status, lastSeen and permissions.

Examples:
- Android: microphone, camera, screen, notifications, apps, accessibility.
- Windows/Linux/macOS: filesystem, terminal, Git, browser, code execution.
- Future devices can register new capabilities without changing the brain.

## Task migration
A run stores its objective, plan, current step, selected device and observations. If a device becomes unavailable, the orchestrator may select another compatible device when the task is safe and resumable.

## Security
Device registration requires authentication. Capability declarations are not permissions by themselves. The safety and permission layers remain authoritative. Secrets stay on the server/device boundary and are never exposed to the model.
