# CLOSI Integrations Build Prompt

## How to use this file
Tell Claude Code: "Read docs/integrations.md and execute each integration in order. Confirm each one is working before moving to the next."

---

## Integration 1: Payment Processing (Stripe)

Reference 03_payment_layer.md for the full payment abstraction architecture.

### 1A: Stripe Connect (OAuth Onboarding)

The business owner connects their own Stripe account to CLOSI. We don't hold their money, Stripe does.

Settings page (owner only):
- "Connect Stripe" button that initiates Stripe Connect OAuth flow
- Redirect to Stripe's hosted onboarding
- On callback, store the connected account ID on the Organization model
- Show connected status: account name, status (active/pending/restricted)
- "Disconnect" button with confirmation

Store on Organization model:
- stripe_account_id (varchar, nullable)
- stripe_connected (boolean, default false)
- stripe_onboarding_complete (boolean, default false)

Backend endpoints:
- GET /api/v1/integrations/stripe/connect (generates OAuth URL, redirects)
- GET /api/v1/integrations/stripe/callback (handles OAuth return, stores account)
- DELETE /api/v1/integrations/stripe/disconnect (removes connection)
- GET /api/v1/integrations/stripe/status (current connection status)

### 1B: Customer + Payment Method Creation

When a contract is signed:
1. Create a Stripe Customer using contact's name and email
2. Store stripe_customer_id on the Contact model
3. Generate a Stripe SetupIntent for the customer
4. Frontend shows a Stripe Elements card input form on the contract page
5. Customer enters card, Stripe tokenizes it client-side
6. Attach the PaymentMethod to the Stripe Customer
7. Store stripe_payment_method_id on the Contract model

### 1C: Subscription Billing

When a contract with a monitoring plan is created:
1. Create a Stripe Product for the monitoring plan if it doesn't exist
2. Create a Stripe Price for the monthly amount
3. Create a Stripe Subscription on the connected account
4. Store stripe_subscription_id on the Subscription model
5. Stripe handles recurring billing automatically

For one-time equipment charges:
1. Create a Stripe PaymentIntent for the equipment total
2. Charge the card on file
3. Create a Payment record in the database

### 1D: Webhook Listener

Endpoint: POST /api/v1/webhooks/stripe (no auth, verified by Stripe signature)

Process these events:
- invoice.payment_succeeded: update Invoice to paid, create Payment record, update contact payment health to green
- invoice.payment_failed: create failed Payment record, update contact health (yellow for 1, red for 2+), trigger failed payment task
- customer.subscription.deleted: update Contract and Subscription status to cancelled, update churn metrics
- customer.subscription.updated: sync status changes
- charge.refunded: create refund Payment record, update Invoice

Webhook security:
- Verify Stripe webhook signature on every request
- Log every payload to payment_webhook_log table BEFORE processing
- Return 200 immediately, process async via Celery task

### 1E: Failed Payment Retry

Stripe handles retries via their Smart Retries, but we layer on notifications:
- On first failure: create task for admin, send customer email
- After 3 failures: create high-priority task for owner, send urgent customer email
- After subscription goes past_due: surface on dashboard as revenue at risk

### 1F: Payment Dashboard Elements

- Payment history on Contact detail (all charges for this customer)
- Payment history on Contract detail (subscription payments)
- Payment history on Invoice detail (payments applied)
- Failed payments alert on owner dashboard
- Stripe connection status indicator in the nav (small icon)

### Verify Integration 1:
- Connect a Stripe test account via OAuth
- Create a contract, enter a test card via Stripe Elements
- Verify subscription is created in Stripe dashboard
- Verify monthly invoice auto-generates
- Simulate a payment failure via Stripe test tools
- Verify webhook processes and creates payment records
- Verify failed payment task is auto-created
- Disconnect Stripe, verify graceful handling

---

## Integration 2: Google Ads Lead Forms

Automatically ingest leads from Google Ads Lead Form Extensions into CLOSI.

### 2A: Webhook Endpoint

Endpoint: POST /api/v1/webhooks/leads/google (secured with a shared secret key)

Google Ads sends lead form submissions via webhook. The payload includes the form data filled out by the prospect.

Processing flow:
1. Verify the request using the shared secret (X-Google-Ads-Webhook-Secret header or URL param)
2. Log the ENTIRE raw payload to raw_inbound_log table immediately
3. Parse the lead data from the Google payload format
4. Apply field mapping (configurable per org in settings)
5. Scrub the data: normalize phone, lowercase email, title case names
6. Deduplicate: check if contact exists by email or phone
7. If new: create Contact with lead_source = "google_ads", create Deal in "New Lead" stage, create Activity "Lead received from Google Ads"
8. If existing: log as Activity on existing contact, optionally create new deal
9. Trigger "Speed to Lead" task generation for this contact immediately (don't wait for the daily run)
10. Send real-time notification to assigned rep (or round-robin assignment)

### 2B: Google Ads Settings Page

Under Settings > Integrations > Google Ads:
- Webhook URL display (copy to clipboard button): https://api.closicrm.com/api/v1/webhooks/leads/google?key=[SECRET]
- Generate/regenerate webhook secret key
- Field mapping configuration: map Google form field names to CLOSI contact fields
- Default lead source label (default: "google_ads")
- Default pipeline stage for new leads (default: "New Lead")
- Default assigned rep (dropdown) or round-robin toggle
- Auto-create deal toggle (default: on)
- Default deal value for Google leads (optional)
- Test webhook button: sends a fake payload to verify the endpoint works
- Activity log: show last 20 received webhooks with timestamp, contact name, status (created/duplicate/error)

### 2C: Google Ads Campaign Tracking

Store on the Contact model or a related lead_attribution table:
- google_campaign_id
- google_campaign_name
- google_adgroup_id
- google_adgroup_name
- google_keyword (if available)
- google_gclid (click ID for conversion tracking)
- form_submission_url

This data feeds into the Lead Source ROI analysis and marketing attribution.

### Verify Integration 2:
- Configure webhook URL and secret in settings
- Send a test payload via curl mimicking Google's format
- Verify contact created, deal created, activity logged
- Verify deduplication on second send
- Verify speed-to-lead task auto-created
- Verify Google campaign data stored for attribution

---

## Integration 3: Facebook Lead Ads

Same pattern as Google, different payload format.

### 3A: Webhook Endpoint

Endpoint: POST /api/v1/webhooks/leads/facebook

Facebook uses a subscribe/verify model:
- GET endpoint for Facebook's verification challenge (hub.mode, hub.challenge, hub.verify_token)
- POST endpoint receives lead data

Processing flow: identical to Google (log raw, parse, scrub, dedup, create contact + deal + activity, trigger speed-to-lead task).

### 3B: Facebook Settings Page

Under Settings > Integrations > Facebook Lead Ads:
- Webhook URL and verify token display
- Facebook Page connection instructions (link to Facebook Business settings)
- Field mapping configuration
- Default lead source label (default: "facebook")
- Same options as Google: default stage, assigned rep, auto-create deal
- Activity log of received webhooks

### 3C: Facebook Campaign Tracking

Store on lead_attribution table:
- facebook_campaign_id
- facebook_campaign_name
- facebook_adset_id
- facebook_adset_name
- facebook_ad_id
- facebook_ad_name
- facebook_form_id

### Verify Integration 3:
- Configure webhook and verify token
- Send Facebook verification challenge, verify response
- Send test lead payload, verify contact created
- Verify deduplication
- Verify campaign data stored

---

## Integration 4: SMS / Texting (Twilio)

Enable reps to send and receive text messages directly from CLOSI.

### 4A: Twilio Account Connection

Settings > Integrations > Twilio (owner/admin only):
- Twilio Account SID input
- Twilio Auth Token input (masked)
- Twilio Phone Number input (the number texts come from)
- Store encrypted on Organization model: twilio_account_sid, twilio_auth_token, twilio_phone_number
- Test connection button: sends a test SMS to the owner's phone
- Connection status indicator

Install: twilio python package
Add to requirements.txt: twilio>=9.0.0

### 4B: Sending Texts

Backend service: backend/app/services/sms_service.py

```python
class SMSService:
    def send(self, to_phone, message, contact_id, user_id, org_id):
        """
        1. Validate phone number format
        2. Send via Twilio API
        3. Log as Activity on the contact (type: sms, direction: outbound)
        4. Store in sms_log table: from, to, body, status, twilio_sid
        5. Return send status
        """
        pass
```

API endpoint:
- POST /api/v1/sms/send { contact_id, message }

Frontend:
- "Send Text" quick-action button on Contact detail page (next to Call, Email, Note)
- Opens a small modal: shows contact name and phone number, text input area, character count (160 char segments), Send button
- Sent texts appear in the contact's activity timeline with the message body
- Text icon (MessageSquare from Lucide) in the timeline

### 4C: Receiving Texts (Inbound)

Endpoint: POST /api/v1/webhooks/twilio/inbound (Twilio sends incoming SMS here)

Processing:
1. Twilio POSTs the incoming message with From, To, Body
2. Match the From phone number to a Contact in the database
3. If matched: create Activity (type: sms, direction: inbound) on the contact
4. If not matched: create a new Contact with just the phone number, create Activity
5. Send real-time notification to the assigned rep (or owner if no rep)
6. Return TwiML response (empty, or auto-reply if configured)

Twilio webhook URL configured in Twilio dashboard: https://api.closicrm.com/api/v1/webhooks/twilio/inbound

### 4D: SMS Templates

Settings > SMS Templates (owner/admin):
- Create reusable text templates with merge fields
- Merge fields: {{first_name}}, {{last_name}}, {{company}}, {{deal_value}}, {{rep_name}}, {{rep_phone}}
- Example templates:
  - "Hi {{first_name}}, this is {{rep_name}} from [ORG_NAME]. I'd love to schedule a time to discuss your home security options. When works best?"
  - "Hi {{first_name}}, just following up on the quote we sent for your security system. Any questions? Reply here or call me at {{rep_phone}}."
  - "Hi {{first_name}}, your security system is installed! If you have any issues, text us here anytime."
- When sending a text, rep can pick a template from a dropdown, it auto-fills with the contact's data, rep can edit before sending

Store templates in an sms_template table: id, org_id, name, body, created_by, created_at

### 4E: Bulk SMS (Campaign Texting)

Accessible from Contacts list page:
- Select multiple contacts via checkboxes
- "Send Text" bulk action button
- Pick a template or write a custom message
- Preview shows each message with merge fields resolved per contact
- Confirm and send
- Backend queues via Celery, sends with 1-second delays to avoid rate limits
- Shows progress: X of Y sent
- Log all as activities on each contact

API endpoint:
- POST /api/v1/sms/bulk-send { contact_ids: [], template_id or message }

### 4F: SMS in AI Agent

Add SMS tools to the CLOSI AI Agent (Step 2 in ai_features.md):
- send_sms(contact_id, message): send a text to a contact
- get_sms_history(contact_id): get text conversation with a contact

Example: "Text John Parker that his install is scheduled for Tuesday"
Agent: [calls send_sms] "Sent: 'Hi John, your security system install is scheduled for Tuesday. We'll arrive between 9-11am. Reply here if you need to reschedule.' to (469) 555-8877"

### Verify Integration 4:
- Configure Twilio credentials in settings
- Send a test SMS from a contact page
- Verify it appears in the activity timeline
- Configure the inbound webhook in Twilio
- Send an inbound text, verify it creates an activity
- Test SMS templates with merge fields
- Test bulk SMS on 3 contacts
- Test AI agent SMS tool

---

## Integration 5: Email Sending (Resend)

Enable transactional and sales emails from within CLOSI.

### 5A: Resend Connection

Settings > Integrations > Email (owner/admin):
- Resend API key input (masked)
- Sending domain (e.g., notifications@closicrm.com or their own domain)
- From name (e.g., "Shield Home Security" or rep's name)
- Store encrypted: resend_api_key, email_from_address, email_from_name
- Test button: sends a test email to the owner

Install: resend python package
Add to requirements.txt: resend>=2.0.0

### 5B: Email Types

Transactional (system-sent):
- Invoice sent notification
- Payment receipt
- Payment failed notification (with update payment link)
- Quote sent notification
- Contract signed confirmation
- Welcome email on new customer conversion

Sales emails (rep-sent):
- From Contact detail page: "Send Email" quick action
- Compose modal: to (pre-filled), subject, rich text body
- Email templates with merge fields (same pattern as SMS templates)
- Sent emails logged as Activity on the contact timeline

### 5C: Email Templates

Settings > Email Templates (owner/admin):
- Template name
- Subject line (supports merge fields)
- HTML body with rich text editor (supports merge fields)
- Default templates provided:
  - "Quote Follow Up"
  - "Post-Install Thank You"
  - "Payment Failed"
  - "Contract Renewal Reminder"
  - "Welcome New Customer"
- Owner can create custom templates

### 5D: Email Tracking

When sending via Resend, store:
- email_log table: to, from, subject, body, status, resend_id, sent_at
- Track opens and clicks via Resend webhooks (optional, future enhancement)

### Verify Integration 5:
- Configure Resend API key
- Send a test email
- Send an email from a contact page
- Verify it logs as activity
- Send an invoice via email
- Test email templates with merge fields

---

## Integration 6: Alarm.com Integration (Phase 2)

This is the must-have integration for your friend. Alarm.com is the monitoring platform most security dealers use.

### 6A: API Connection

Settings > Integrations > Alarm.com (owner/admin):
- Alarm.com dealer portal credentials (encrypted)
- API key if available (Alarm.com has a partner API)
- Connection status

### 6B: Customer Sync

When a contract is signed in CLOSI:
- Auto-create the customer account in Alarm.com
- Push equipment list (panel model, sensors, cameras)
- Activate monitoring service
- Sync back the Alarm.com customer ID and account status

### 6C: Equipment + Service Data

Pull from Alarm.com:
- System status (armed/disarmed/alarm events)
- Equipment health (low battery, offline sensors)
- Service tickets

Display on Contact detail page:
- "System Status" section showing Alarm.com data
- Alert if a customer's system has issues (potential churn signal)

### 6D: Churn Signal

Feed Alarm.com data into the churn prediction model:
- Customers who frequently disarm and don't re-arm may be disengaging
- Customers with repeated equipment issues may be frustrated
- System offline for extended periods is a red flag

NOTE: Alarm.com API access requires a dealer partnership agreement. This integration should be architected with the adapter pattern so it can be built once the API access is secured. Build the interface and data models now, implement the actual API calls when access is available.

---

## Integration 7: Generic Webhook Receiver

A catch-all webhook endpoint for any lead source that can send webhooks (Zapier, Make, Yelp, HomeAdvisor, Angi, etc.)

### 7A: Endpoint

POST /api/v1/webhooks/leads/generic?source=[SOURCE_NAME]&key=[SECRET]

Processing:
1. Verify secret key
2. Log raw payload to raw_inbound_log
3. Attempt to auto-detect field mapping from common patterns
4. If a saved import template exists for this source name, use that mapping
5. Create contact + deal + activity
6. Trigger speed-to-lead task

### 7B: Settings

Settings > Integrations > Custom Webhooks:
- List of configured webhook sources
- Each source has: name, webhook URL (auto-generated), secret key, field mapping, default lead source, default stage, default rep
- Activity log per source

This means any lead source that can hit a URL can feed into CLOSI. Zapier alone opens up hundreds of services.

### Verify Integration 7:
- Create a custom webhook source "Yelp Leads"
- Send a test payload via curl
- Verify contact created with correct source

---

## Data Models for Integrations

Add these to the database:

```sql
-- Integration credentials (encrypted)
ALTER TABLE organization ADD COLUMN stripe_account_id VARCHAR;
ALTER TABLE organization ADD COLUMN stripe_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE organization ADD COLUMN twilio_account_sid_encrypted VARCHAR;
ALTER TABLE organization ADD COLUMN twilio_auth_token_encrypted VARCHAR;
ALTER TABLE organization ADD COLUMN twilio_phone_number VARCHAR;
ALTER TABLE organization ADD COLUMN resend_api_key_encrypted VARCHAR;
ALTER TABLE organization ADD COLUMN email_from_address VARCHAR;
ALTER TABLE organization ADD COLUMN email_from_name VARCHAR;
ALTER TABLE organization ADD COLUMN alarmcom_credentials_encrypted VARCHAR;

-- SMS Log
CREATE TABLE sms_log (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organization(id),
    contact_id UUID REFERENCES contact(id),
    user_id UUID REFERENCES "user"(id),
    direction VARCHAR NOT NULL, -- outbound, inbound
    from_number VARCHAR NOT NULL,
    to_number VARCHAR NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR NOT NULL, -- queued, sent, delivered, failed
    twilio_sid VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email Log
CREATE TABLE email_log (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organization(id),
    contact_id UUID REFERENCES contact(id),
    user_id UUID REFERENCES "user"(id),
    to_email VARCHAR NOT NULL,
    from_email VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR NOT NULL, -- sent, delivered, opened, bounced, failed
    resend_id VARCHAR,
    email_type VARCHAR, -- transactional, sales, campaign
    created_at TIMESTAMP DEFAULT NOW()
);

-- SMS Templates
CREATE TABLE sms_template (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organization(id),
    name VARCHAR NOT NULL,
    body TEXT NOT NULL,
    created_by UUID REFERENCES "user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Email Templates
CREATE TABLE email_template (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organization(id),
    name VARCHAR NOT NULL,
    subject VARCHAR NOT NULL,
    body TEXT NOT NULL,
    email_type VARCHAR, -- quote_followup, payment_failed, welcome, custom
    created_by UUID REFERENCES "user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Lead Attribution (extends contact data for campaign tracking)
CREATE TABLE lead_attribution (
    id UUID PRIMARY KEY,
    contact_id UUID REFERENCES contact(id),
    organization_id UUID REFERENCES organization(id),
    source_platform VARCHAR, -- google_ads, facebook, yelp, etc.
    campaign_id VARCHAR,
    campaign_name VARCHAR,
    adgroup_id VARCHAR,
    adgroup_name VARCHAR,
    ad_id VARCHAR,
    ad_name VARCHAR,
    keyword VARCHAR,
    click_id VARCHAR, -- gclid, fbclid, etc.
    form_id VARCHAR,
    landing_page_url VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook Source Configuration
CREATE TABLE webhook_source (
    id UUID PRIMARY KEY,
    organization_id UUID REFERENCES organization(id),
    name VARCHAR NOT NULL,
    source_key VARCHAR NOT NULL, -- URL slug
    secret_key VARCHAR NOT NULL,
    field_mapping JSONB,
    default_lead_source VARCHAR,
    default_stage_id UUID REFERENCES pipeline_stage(id),
    default_assigned_to UUID REFERENCES "user"(id),
    auto_create_deal BOOLEAN DEFAULT TRUE,
    default_deal_value DECIMAL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Integrations Settings Page Layout

Build a dedicated Integrations page in Settings with cards for each integration:

Layout: grid of integration cards, each showing:
- Integration logo/icon
- Name
- Status badge: "Connected" (green), "Not Connected" (gray), "Error" (red)
- Brief description
- "Configure" button

Cards:
1. Stripe - Payment Processing - "Accept payments and manage subscriptions"
2. Google Ads - Lead Generation - "Auto-import leads from Google Ads forms"
3. Facebook - Lead Generation - "Auto-import leads from Facebook Lead Ads"
4. Twilio - SMS/Texting - "Send and receive text messages with leads and customers"
5. Resend - Email - "Send invoices, quotes, and sales emails"
6. Alarm.com - Monitoring Platform - "Sync customer accounts and equipment" (Coming Soon badge)
7. Custom Webhooks - "Connect any lead source via webhooks"

Clicking "Configure" opens the specific settings panel for that integration.

---

## Build Order

1. Stripe (payment processing is core to the product)
2. Twilio SMS (reps text more than they email in this industry)
3. Resend Email (invoices and notifications need email)
4. Google Ads webhook (most common paid lead source)
5. Facebook webhook (second most common)
6. Generic webhook (catch-all for everything else)
7. Alarm.com (when API access is secured)

---

## Verify All Integrations:
1. Stripe: full payment flow from contract to recurring billing
2. Twilio: send text, receive text, bulk text, templates
3. Resend: send invoice email, send sales email, templates
4. Google: receive webhook, create contact, deduplicate
5. Facebook: receive webhook, verify challenge, create contact
6. Generic: receive webhook from custom source, create contact
7. All webhook payloads logged to raw_inbound_log
8. All communications (SMS, email) logged as activities on contacts
9. Lead attribution data stored for Google and Facebook leads
10. Integration status shows correctly on Settings page
11. AI agent can send texts and reference communication history
