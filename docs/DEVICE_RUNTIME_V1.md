# Jarvis Device Runtime V1

## Device Registry
The cloud runtime maintains authenticated device records with:
- deviceId
- ownerId
- platform
- appVersion
- status
- capabilities
- permissions
- lastSeen
- metadata

## Status
A device is considered online only while its authenticated heartbeat is fresh. Missing heartbeats transition the device to offline after a server-defined timeout.

## Capability Registry
Capabilities are normalized identifiers such as:
- filesystem.read
- filesystem.write
- terminal.execute
- git
- browser
- screen.read
- screen.control
- microphone
- notifications

A capability describes technical availability, not authorization.

## Capability Resolution
Given an action requirement, the runtime:
1. derives required capabilities;
2. filters authenticated devices;
3. filters online devices;
4. checks capability compatibility;
5. checks permission and safety policy;
6. ranks candidates;
7. selects a device or reports that no suitable device exists.

## Device Router
The router must be deterministic and observable. It should prefer:
1. explicit user/device selection;
2. an already assigned device for a resumable run;
3. a compatible online device;
4. lower latency / better availability when equivalent;
5. no device when requirements cannot be safely satisfied.

## Task delivery
Tasks should have stable IDs and idempotency keys. Device agents acknowledge receipt and report progress/results. The cloud remains the source of truth for AgentRun state.

## Failure and rerouting
If a device disappears before execution, the router may select another compatible device. For mutating operations, rerouting is allowed only when idempotency and safety requirements are satisfied.

## V1 scope
This document is a contract for implementation. It does not yet prescribe a database, queue, WebSocket library, or operating-system-specific agent implementation.
