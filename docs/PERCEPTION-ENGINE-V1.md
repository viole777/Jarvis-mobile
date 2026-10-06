# Jarvis Perception Engine V1

The Perception Engine is the boundary between external events and the cognitive core.

It does not decide what an event means and it does not execute actions. It normalizes an observed event and passes it to the cognitive core for evaluation.

## Event contract

```json
{
  "id": "event-id",
  "subjectId": "user-id",
  "type": "device.disconnected",
  "data": {},
  "source": "device-runtime",
  "observedAt": "2026-10-06T12:00:00.000Z"
}
```

## Design rule

Do not encode emotional conclusions in perception events. A perception says what was observed; the cognitive layer determines significance, uncertainty, hypotheses and internal state.

Bad:

```text
user_is_in_danger = true
```

Good:

```text
user_presence.changed
last_interaction.age_changed
phone.connection.lost
```

The cognitive core can combine several observations with memory and expectations before deciding whether concern or another internal state should change.

## Safety

Perception is advisory. It cannot grant permissions, contact third parties, bypass confirmation gates, or execute device actions. Consequential actions remain behind the existing policy, permission and safety layers.

## Next phase

Connect real device/cloud events, add expectation modeling, deduplication and event persistence, then feed bounded proactive evaluation into the orchestrator.
