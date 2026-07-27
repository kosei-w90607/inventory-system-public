# Codex / GPT-5.6 Agent Guidance

This directory adapts current OpenAI guidance to this repository without changing the workflow contracts in [DEV_WORKFLOW.md](../DEV_WORKFLOW.md).

## Reading route

1. Read [GPT-5.6 Shared Contract](gpt-5.6-shared.md).
2. Read the slot-neutral profile assigned through [AGENT_OPERATING_MANUAL.md §3.4](../AGENT_OPERATING_MANUAL.md#34-model-slot-対応表):
   - [frontier](profiles/frontier.md)
   - [balanced](profiles/balanced.md)
   - [high-throughput](profiles/high-throughput.md)
3. If runtime identity or assignment is unavailable, use `frontier`.
4. Continue to the task-specific design document selected by root [AGENTS.md](../../AGENTS.md) `Session Start`.

Profiles describe task fit and response economy only. They must not change approval boundaries, autonomy, validation, workflow phases, Human Gates, or stop conditions from the shared contract and repository source docs.

Personal response style belongs in an ignored root `AGENTS.override.md`, not in tracked guidance. Because a root override replaces the root instruction file during discovery, it must load `./AGENTS.md` before applying any local extension.

The public, extension-neutral regression fixture is [Decision Gate Fixture](evals/decision-gate-fixture.md). Prompts, outputs, scores, and local extensions used in an actual comparison remain local-only.

## Sources

- OpenAI: [GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/model-guidance?model=gpt-5.6)
- OpenAI: [Prompting guidance for GPT-5.6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)
- OpenAI: [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
