# CLOSI AI Features Build Prompt

## How to use this file
Tell Claude Code: "Read docs/ai_features.md and execute Step 1 first. Confirm it's working before moving to Step 2."

---

## Step 1: AI Daily Task Generator

Build an automated task generation system that analyzes CRM data and creates recommended tasks each morning.

### Celery Scheduled Task

Create backend/app/tasks/ai_task_generator.py

This runs daily at 7am via celery-beat. It processes all organizations and generates tasks based on the rules below. Also add a manual trigger endpoint so users can refresh on demand.

Register in celery-beat:
```python
'generate-ai-tasks-daily': {
    'task': 'tasks.ai_task_generator.generate_daily_tasks',
    'schedule': crontab(hour=7, minute=0),
}
```

### Task Generation Rules

SPEED TO LEAD:
- Any contact created yesterday with no activity yet
- Create task: "Call new lead [name] - no contact made yet"
- Type: call, Priority: high, Due: today
- Assign to the rep who owns the deal, or round-robin if unassigned

STALE DEALS:
- Any deal in the same stage longer than the stage's stale_days threshold
- Create task: "Follow up on stale deal [deal name] - [X] days in [stage]"
- Type: follow_up, Priority: high, Due: today
- Assign to the deal's assigned rep

QUOTE FOLLOW UP:
- Any deal in "Quote Sent" stage with no activity in 3+ days
- Create task: "Follow up on quote for [contact name] - sent [X] days ago"
- Type: call, Priority: medium, Due: today
- Assign to the deal's assigned rep

CONTRACT EXPIRING:
- Any contract expiring in the next 30 days without auto-renewal
- Create task: "Renewal conversation with [contact name] - contract expires [date]"
- Type: call, Priority: high, Due: 30 days before expiration
- Assign to the original deal's rep, or owner if no rep

FAILED PAYMENTS:
- Any contact with a failed payment in the last 7 days
- Create task: "Resolve payment issue for [contact name] - payment failed [date]"
- Type: follow_up, Priority: high, Due: today
- Assign to admin/office manager role

NO RECENT ACTIVITY:
- Any open deal with no activity in 7+ days
- Create task: "Check in on [deal name] - no activity in [X] days"
- Type: follow_up, Priority: medium, Due: today
- Assign to the deal's assigned rep

POST-INSTALL CHECK-IN:
- Any deal that moved to "Installed" stage 3 days ago
- Create task: "Post-install check-in with [contact name]"
- Type: call, Priority: medium, Due: today
- Assign to the deal's assigned rep

### Deduplication

Before creating any task, check if an identical open task already exists with the same type, same contact/deal, and similar description. If so, skip it. Never create duplicate tasks.

### AI Task Tagging

All auto-generated tasks get a field: ai_generated = true and a field: ai_rule = "speed_to_lead" (or whichever rule triggered it). This distinguishes them from manual tasks.

Add ai_generated (boolean, default false) and ai_rule (varchar, nullable) columns to the Task model. Run the migration.

### API Endpoints

- POST /api/v1/tasks/ai-generate (manual trigger, owner/admin only)
- GET /api/v1/tasks/ai-recommended (today's AI tasks for current user)
- PATCH /api/v1/tasks/:id/snooze (push due date by 1 day)
- PATCH /api/v1/tasks/:id/dismiss (mark as dismissed, not completed)

### Dashboard Widget: "AI Recommended Actions"

Add this section to the TOP of both the owner dashboard and the rep dashboard, above the existing KPI cards.

Owner dashboard shows all AI tasks for today across all reps. Rep dashboard shows only AI tasks assigned to that rep.

Layout:
- Section header: "Recommended Actions" with a sparkle icon and a "Generate Now" button on the right
- Tasks listed as cards, grouped by priority (high first, then medium)
- Each card shows:
  - Task description
  - Contact name (clickable link to contact)
  - Deal name if applicable (clickable link to deal)
  - Why it was generated (e.g., "No contact made in 3 days", "Quote sent 5 days ago")
  - Assigned rep name
- Three action buttons per card:
  - "Complete" (green) - marks task complete, logs activity on contact/deal
  - "Snooze" (yellow) - pushes due date by 1 day, removes from today's list
  - "Dismiss" (gray) - marks as dismissed, removes from recommendations
- If no AI tasks for today, show: "All caught up! No recommended actions for today."

### Settings Page Addition

Add an "AI Task Generator" section to the Organization Settings page (owner/admin only):

- Toggle: AI task generation on/off (default: on)
- Generation time: dropdown to pick hour (default: 7am)
- Rule toggles: enable/disable each rule individually
  - Speed to Lead (on by default)
  - Stale Deals (on by default)
  - Quote Follow Up (on by default)
  - Contract Expiring (on by default)
  - Failed Payments (on by default)
  - No Recent Activity (on by default)
  - Post-Install Check-In (on by default)
- Configurable thresholds:
  - Quote follow-up days (default: 3)
  - No activity warning days (default: 7)
  - Contract expiration warning days (default: 30)
  - Post-install check-in days (default: 3)

Store these settings in the Organization model as a JSON field: ai_task_settings

### Verify Step 1:
- Run the task generator manually via the API endpoint
- Verify tasks are created based on seed data conditions
- Verify deduplication (run it twice, no duplicates)
- Verify dashboard widget shows the generated tasks
- Verify Complete/Snooze/Dismiss buttons all work
- Verify rep dashboard only shows tasks for that rep
- Verify settings toggles enable/disable rules
- Verify the "Generate Now" button triggers a refresh

---

## Step 2: CLOSI AI Agent (Claude-powered Chat)

Build an AI chat assistant powered by the Claude API that can answer questions about business data and take actions inside the CRM.

### Dependencies

Install: anthropic python package
Add to requirements.txt: anthropic>=0.40.0

### API Key Configuration

Add an "AI Agent" section to Organization Settings (owner only):
- API key input field (masked, show last 4 chars)
- Store encrypted in the database on the Organization model: encrypted_anthropic_api_key
- Test connection button that makes a simple API call to verify the key works
- If no key is set, the chat panel shows: "AI agent not configured. Ask your admin to add an Anthropic API key in Settings."

### Backend AI Service

Create backend/app/services/ai_agent.py

```python
class CLOSIAgent:
    def __init__(self, org_id, user_id, session):
        self.org_id = org_id
        self.user_id = user_id
        self.session = session
        self.client = anthropic.Anthropic(api_key=self._get_api_key())

    def chat(self, message, conversation_history, page_context=None):
        """
        1. Build system prompt with org context
        2. Include page context if provided
        3. Send to Claude with tools
        4. Process any tool calls (loop until done)
        5. Return final response and actions taken
        """
        pass
```

### System Prompt

```
You are CLOSI AI, a sales assistant for [ORG_NAME], a home 
security dealer. You have access to the company's CRM data 
including contacts, deals, pipeline, tasks, contracts, invoices, 
payments, and activity history.

Current user: [USER_NAME] ([USER_ROLE])
Current time: [DATETIME]
Organization: [ORG_NAME], [ORG_LOCATION]

Guidelines:
- Answer questions using real CRM data, not guesses
- Be concise and actionable
- Use plain language a small business owner understands
- When suggesting actions, offer to do them (create tasks, update records)
- If you take an action, confirm what you did
- If you don't have enough data to answer, say so
- Never use em dashes
- Format numbers as currency where appropriate
- Keep responses under 200 words unless the user asks for detail
```

### Tools for Claude

Query tools (read-only):

search_contacts:
- Parameters: query (string), lead_source (string, optional)
- Returns: list of matching contacts with basic info

get_contact_detail:
- Parameters: contact_id (uuid)
- Returns: full contact with deals, tasks, activities, payments, subscription

list_deals:
- Parameters: stage (string, optional), rep_id (uuid, optional), status (string: open/won/lost)
- Returns: list of deals with contact name, value, stage, days in stage

get_deal_detail:
- Parameters: deal_id (uuid)
- Returns: full deal with stage history, activities, quotes

get_pipeline_summary:
- No parameters
- Returns: deal count and total value per stage

get_dashboard_metrics:
- No parameters
- Returns: MRR, pipeline value, deals won, conversion rate, CAC, LTV, churn rate

get_overdue_tasks:
- Parameters: rep_id (uuid, optional)
- Returns: list of tasks past due date

get_stale_deals:
- Parameters: days_threshold (int, default 7)
- Returns: deals with no activity in X days

get_revenue_at_risk:
- No parameters
- Returns: expiring contracts (30/60/90 days), failed payments, past-due subscriptions

get_rep_performance:
- Parameters: rep_id (uuid), period (string: this_week/this_month/this_quarter)
- Returns: deals created, won, lost, win rate, revenue, avg deal value, activities

get_lead_source_roi:
- No parameters
- Returns: per-source stats (leads, conversions, revenue, spend, ROI)

get_recent_activities:
- Parameters: limit (int, default 10), contact_id (uuid, optional)
- Returns: recent activities with type, description, contact, timestamp

get_active_subscriptions:
- No parameters
- Returns: all active subscriptions with customer name, amount, status, tenure

Action tools (write):

create_task:
- Parameters: title, type, priority, due_date, assigned_to, contact_id (optional), deal_id (optional)
- Creates the task, returns confirmation
- Log as ai_generated = true

create_activity:
- Parameters: type (call/email/note/meeting), description, contact_id, deal_id (optional)
- Creates the activity, returns confirmation

update_deal_stage:
- Parameters: deal_id, stage_name
- Moves the deal, creates stage history entry, returns confirmation

create_contact:
- Parameters: first_name, last_name, email (optional), phone (optional), lead_source (optional)
- Creates contact, returns confirmation with contact_id

### API Endpoint

POST /api/v1/ai/chat
```json
Request:
{
    "message": "How's the pipeline looking?",
    "conversation_history": [
        {"role": "user", "content": "previous message"},
        {"role": "assistant", "content": "previous response"}
    ],
    "page_context": {
        "page": "contact_detail",
        "contact_id": "uuid-here"
    }
}

Response:
{
    "response": "You've got 26 open deals worth $74,400...",
    "actions_taken": [
        {"type": "create_task", "description": "Created task: Call Patricia Gomez", "record_id": "uuid"}
    ]
}
```

### Rate Limiting (Tiered by Plan)

Store a daily request counter per user in Redis (fall back to database).
Limits are based on the organization's plan tier stored on the Organization model.

Add a field to Organization: plan_tier (varchar, default "starter")

Plan tiers and limits:
- starter: 10 AI requests per user per day (included free)
- pro: 100 AI requests per user per day

Return remaining count and plan tier in every response:
```json
{
    "response": "...",
    "usage": {
        "requests_used": 7,
        "requests_limit": 10,
        "plan": "starter",
        "resets_at": "2026-02-28T00:00:00Z"
    }
}
```

When limit is hit, do NOT let them send more messages. Show an upgrade prompt in the chat panel:

"You've used all 10 AI requests for today. Upgrade to CLOSI Pro 
for 100 daily requests, Alarm.com integration, inventory management, 
and custom analytics consulting."

Two buttons:
- "Contact Sales" - opens mailto:sales@closicrm.com with a 
  pre-filled subject line: "Interested in upgrading to CLOSI Pro"
  Include the org name and current plan in the email body.
- "Remind Me Tomorrow" - dismisses the prompt for this session

Show a usage bar in the chat panel header that fills up as they 
use requests. Green under 50%, yellow 50-80%, red above 80%.

When they're at 80% of their limit, show a subtle inline message 
in the chat: "You have [X] AI requests remaining today. Need more? 
Upgrade your plan."

Owner/admin can see total AI usage across all users in Settings:
- Table: user name, requests today, requests this month
- Total org cost estimate based on token usage (approximate)
- Current plan tier with upgrade button

### Context Window Management

- Only send the last 10 messages as conversation_history to Claude
- If the user is on a specific page, include that page's data automatically as a system message
- Page context mapping:
  - contact_detail page: include full contact data
  - deal_detail page: include full deal data
  - pipeline page: include pipeline summary
  - dashboard page: include current KPIs
  - tasks page: include overdue tasks count
  - recurring_revenue page: include MRR summary

### Frontend Chat Panel

Floating button:
- Fixed position bottom-right corner, 56px circle
- CLOSI purple (#6C63FF) background
- Chat bubble icon (from Lucide: MessageSquare)
- Small sparkle badge to indicate AI
- Cmd+J keyboard shortcut toggles the panel

Chat panel:
- 400px wide slide-out from the right edge
- Header: "CLOSI AI" with sparkle icon, close button, clear conversation button
- Message list area (scrollable):
  - User messages: right-aligned, light purple background
  - AI messages: left-aligned, white background on light theme
  - Action cards: when the agent takes an action, show an inline card with icon, description, and link to the created/updated record
  - Typing indicator: three animated dots while waiting for Claude
- Input area at bottom:
  - Text input with placeholder "Ask CLOSI AI anything..."
  - Send button (purple)
  - Enter to send, Shift+Enter for new line
  - Remaining daily requests shown as a usage bar below input: 
    green under 50%, yellow 50-80%, red above 80%
  - Text: "7/10 requests remaining" with plan name
  - When limit hit: full-width upgrade prompt replaces the input 
    field with "Contact Sales" and "Remind Me Tomorrow" buttons

Conversation state:
- Store in Zustand, persists during browser session
- Clear button resets the conversation
- Closing the panel does not clear the conversation

### Error Handling

- No API key: show setup message with link to Settings
- API error: "Something went wrong. Try again." with retry button
- Network error: "Can't reach the AI service. Check your connection."
- Rate limited: show friendly limit message with reset time
- Timeout (30s): "That took too long. Try a simpler question."

### Verify Step 2:
- Configure API key in Settings
- Open chat panel via floating button
- Ask "How's the pipeline looking?" - verify it queries real data
- Ask "Who are my newest leads?" - verify it searches contacts
- Ask "Create a task to call John Parker tomorrow" - verify task created
- Ask "Move the Parker deal to Contacted" - verify stage updated
- Navigate to a contact page, ask "What should I do with this lead?" - verify page context
- Ask 10 questions on starter plan, verify rate limit kicks in
- Verify upgrade prompt shows with Contact Sales and Remind Me buttons
- Verify usage bar changes color as requests are consumed
- Verify 80% warning message appears inline
- Change org to pro plan, verify limit increases to 100
- Clear conversation, verify it resets
- Test with no API key, verify setup message shows
- Test Cmd+J shortcut
