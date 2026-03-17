# Feedback Widget Enhancement — Interactive Chatbot

**Created**: 2026-03-17
**Status**: Planned
**Priority**: P2
**Scope**: Feedback widget SDK (embeddable in all apps) + Hub backend

## Overview

Enhance the existing voice feedback widget with an interactive chatbot mode. Instead of just recording voice feedback and submitting it, the widget can engage in a conversation to dig deeper into the user's issue. Users can:

1. **Type** their feedback (text chat) in addition to voice
2. **Click on areas of the screen** to show the chatbot exactly what they mean
3. **Verbally describe** while pointing to UI elements
4. The chatbot **asks follow-up questions** to clarify the issue
5. **Multimodal capture**: text + voice + screenshot annotations combined into a rich feedback session

## Architecture

### Enhanced Widget States

Current: `hidden → idle → recording → processing → submitted`

New: `hidden → idle → [recording | chatting] → [processing | follow-up] → submitted`

**Chat Mode:**
- Text input field at bottom of widget
- Message bubbles (user + bot)
- Bot powered by Bedrock Claude Haiku 4.5 (fast, cheap)
- Bot has context: current page URL, app name, user's role, previous messages
- Bot asks clarifying questions: "Can you show me where on the screen?" → triggers screenshot annotation mode

**Screenshot Annotation Mode:**
- User clicks "Show me" or bot asks them to point
- Widget overlays a semi-transparent layer on the page
- User clicks/draws on the page → coordinates + element info captured
- Screenshot taken with annotation overlay
- Sent to bot as context: "User pointed at [element] at coordinates (x, y) on page /settings"

**Voice + Chat Hybrid:**
- Mic button in chat interface for voice messages
- Voice transcribed (AWS Transcribe) and added as chat message
- Bot can respond with text (displayed) or trigger actions (take screenshot, highlight element)

### Backend

**New Lambda: `sevaro-feedback-chat`**
- Bedrock Converse API with Haiku 4.5
- System prompt: "You are a helpful product feedback assistant for Sevaro Health. Ask clarifying questions to understand the user's issue. Be concise. When the issue is clear, summarize it."
- Conversation history maintained in DynamoDB (keyed by sessionId)
- After conversation ends: auto-generate structured feedback (category, severity, action items) from the chat transcript

**Enhanced Feedback Session Schema:**
```
+ chatMessages[]: { role, content, timestamp, attachments[] }
+ annotations[]: { screenshotKey, coordinates, elementInfo, userComment }
+ chatSummary: string (AI-generated from conversation)
```

### Widget SDK

The feedback widget should be a standalone JS bundle that any Sevaro app can embed:
```html
<script src="https://hub.neuroplans.app/feedback-widget.js"></script>
<script>SevaroFeedback.init({ appId: 'evidence-engine', userId: '...' })</script>
```

Or as a React component for Next.js apps:
```jsx
import { FeedbackWidget } from '@sevaro/feedback-widget'
<FeedbackWidget appId="evidence-engine" />
```

## Steps

1. Design chat UI within existing widget frame
2. Create `sevaro-feedback-chat` Lambda with Bedrock Haiku
3. Add text input + message display to widget
4. Implement screenshot annotation overlay
5. Add voice-in-chat (mic button → transcribe → add as message)
6. Auto-summarize conversation into structured feedback on submit
7. Update Hub feedback dashboard to display chat transcripts and annotations
8. Package widget as standalone embeddable SDK
9. Test across Evidence Engine, OPSAmple, and Hub

## Files

- New Lambda: `lambda/sevaro-feedback-chat/`
- Enhance widget: wherever the current FeedbackWidget lives in each app
- Hub dashboard: `src/app/feedback/[id]/SessionDetailClient.tsx` — display chat + annotations
- New: widget SDK bundle (build target in Hub or separate package)
