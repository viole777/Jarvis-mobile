# Runtime Cognitive Core

The runtime cognitive layer now sits before the normal agent loop.

Flow:

1. load subject cognitive state and self-model
2. evaluate the new observation with the CognitiveEngine
3. persist the cognitive snapshot
4. derive/update the functional self-model
5. run the normal planner/tool loop
6. record the result back into the self-model

This is functional cognition, not a claim of subjective consciousness.

The self-model is intentionally bounded and inspectable. It must not be treated as evidence that Jarvis is conscious.
