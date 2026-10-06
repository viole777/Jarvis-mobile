# Jarvis Device Runtime V1

The cloud brain is platform-agnostic. Devices expose capabilities; the brain selects a compatible device.

## Runtime model

Cloud:
- DeviceRegistry tracks registered devices and heartbeat state.
- CapabilityRouter resolves a device from required capabilities.
- Platform agents execute only through their local permission and safety boundary.

A device is not selected merely because it is Android or Windows. Selection is based on capabilities and availability; policy and risk checks will be added before dispatch.

## V1 lifecycle

1. register(device)
2. heartbeat(deviceId)
3. resolve(requiredCapabilities)
4. dispatch a task to the selected agent (next phase)
5. observe the result
6. validate completion
7. persist task state

## Device state

- online: recent heartbeat.
- offline: heartbeat exceeded the registry timeout.
- unknown: registered but not yet observed.

## Capability examples

Windows: filesystem, terminal, git, browser, code_execution.

Android: microphone, camera, screen, notifications, apps, accessibility.

These are declarations, not permissions. The agent and cloud policy must still authorize every operation.

## Design constraints

- Never trust a client-provided capability as proof of permission.
- Never expose cloud credentials to a device agent.
- Never let model output execute directly on a device.
- Device execution must be observable and cancellable.
- A lost connection must not silently cause a duplicate consequential action.
