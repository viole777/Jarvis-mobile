# Jarvis Brain

The project formerly called Mentilisa is now Jarvis.

The cloud brain is separate from Android, tools and product-specific modules.

Target loop:

UNDERSTAND -> PLAN -> ACT -> OBSERVE -> EVALUATE -> ADAPT -> VALIDATE -> RESPOND

The loop is always bounded by execution budgets.

The existing ml/ pipeline starts from Qwen/Qwen3-0.6B and uses teacher-generated examples plus LoRA/QLoRA. Teacher models teach; they do not become Jarvis's permanent decision authority.

The cloud brain may request an action, but it cannot grant itself Android permissions. Android Safety Engine remains authoritative.

Future self-improvement must be evaluated, versioned and constrained by safety policies.
