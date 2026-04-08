# Alarm.com Integration Plan

## Status: Waiting on API Access

Medley & Sons uses Alarm.com as their monitoring platform. The goal is one-profile creation — create the customer in LSRV CRM and it auto-populates in Alarm.com.

## Current Blocker

Alarm.com has no public API or sandbox. Access requires:
- Dealer account (Medley has one as a licensed installer)
- Technology partner application (for LSRV as a software vendor)

## Action Items

1. Ask Medley for their Alarm.com dealer portal credentials
2. Contact Alarm.com partner program about technology partner access
3. Get sandbox/test environment provisioned

## Option 3: Stub Integration (Build Now, Connect Later)

Build the full integration layer with mock responses:

### What gets built now
- `backend/app/integrations/alarmcom_service.py` — stub service with functions:
  - `create_customer(contact_id)` → returns fake ADC account ID
  - `get_system_status(adc_account_id)` → returns online/offline/alarm status
  - `activate_monitoring(adc_account_id, plan)` → returns activation confirmation
  - `deactivate_monitoring(adc_account_id)` → returns deactivation confirmation
- `backend/app/api/alarmcom.py` — API endpoints for the frontend
- Database: `alarmcom_account_id` field on contact or a linking table
- Frontend: Monitoring section on account page showing system status, account ID, plan
- Automation: "Installed" stage trigger creates Alarm.com account automatically

### What changes when real API access arrives
- Replace stub functions in `alarmcom_service.py` with real HTTP calls
- Add OAuth2 credentials to `.env`
- Everything else (UI, database, automations) stays the same

### What this does NOT do until real API access
- Actually create accounts in Alarm.com
- Pull real system status
- Medley still creates Alarm.com accounts manually

## Integration Points in the Customer Lifecycle

1. **Deal moves to "Installed"** → auto-create Alarm.com customer account
2. **Account page** → show monitoring status (online/offline), account ID, panel info
3. **Billing Ops** → monitoring status column per customer
4. **Monthly invoice** → include monitoring plan details
5. **Customer deactivation** → deactivate Alarm.com account

## Alarm.com Partner API (Known from Research)

- Auth: OAuth 2.0 (client credentials or authorization code)
- Endpoints (partner tier dependent):
  - Customer/account management (create, modify, deactivate)
  - System status (arm/disarm, sensor status, panel connectivity)
  - Device management (locks, thermostats, cameras, sensors)
  - Event/activity history (alarms, alerts, system events)
- No public docs — provided after partner approval
