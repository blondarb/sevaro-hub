---
id: hub-001
title: Feedback widget chatbot enhancement
priority: P2
status: pending
repo: sevaro-hub
plan: docs/plans/2026-03-17-feedback-chatbot-widget.md
estimated_scope: large
created: 2026-03-17
completed: null
---

## Prompt

In the sevaro-hub repo (`/Users/stevearbogast/dev/repos/sevaro-hub/`), enhance the voice feedback widget with an interactive chatbot mode that can dig deeper into user issues.

Read `docs/plans/2026-03-17-feedback-chatbot-widget.md` for the full plan.

This is an enhancement to the existing feedback widget (which currently only does voice recording). The widget should be embeddable in any Sevaro app. New capabilities:

1. **Text chat mode** — add a text input field and message bubbles to the widget. Users can type feedback instead of (or in addition to) speaking.
2. **AI chatbot** — powered by Bedrock Claude Haiku 4.5 via a new Lambda `sevaro-feedback-chat`. The bot asks follow-up questions to clarify the issue ("Can you show me where on the screen?", "What did you expect to happen?").
3. **Screenshot annotation** — when the bot asks the user to "show me", overlay a semi-transparent layer on the page. User clicks/draws on areas → captures coordinates + element info + screenshot.
4. **Voice in chat** — mic button in the chat interface transcribes voice and adds it as a chat message.
5. **Auto-summarize** — when the conversation ends, the bot generates a structured summary (category, severity, action items) from the full transcript.

Backend: Create `sevaro-feedback-chat` Lambda with Bedrock Converse API (Haiku 4.5). Store chat messages in DynamoDB alongside existing feedback sessions.

Update the Hub feedback dashboard (`/feedback/[id]`) to display chat transcripts and screenshot annotations.

Use `--profile sevaro-sandbox` for all AWS commands. After implementing, run `/codex-review`. Commit when working.
