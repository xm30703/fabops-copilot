# MES queue backlog 訊息積壓

## Capture and escalate / 蒐證與升級
SYNTHETIC DEMO PROCEDURE. For MES queue backlog above 1000 messages, capture queue depth, p95 latency, upstream timeout errors and retry rate. Check upstream health and recent retry configuration changes. Avoid increasing retries during an outage. Notify the integration on-call engineer and draft an IT incident. Do not discard messages.

## Safe replay review / 重送審查
Before any synthetic queue replay, verify event idempotency keys and test a small replay in the sandbox. Reconcile counts and event ordering. Queue replay requires human approval and is outside this application's capabilities. A configuration change is a hypothesis, not proof of causation.
