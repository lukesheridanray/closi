import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, MessageSquare, Mail, Globe, Megaphone,
  Radio, Webhook, CheckCircle2, Loader2, Calendar, CalendarDays
} from 'lucide-react'
import { stripeApi, authnetApi } from '@/lib/api'
import type { StripeStatus, AuthnetStatus } from '@/lib/api'

interface IntegrationCard {
  id: string
  name: string
  category: string
  description: string
  icon: React.ReactNode
  status: 'connected' | 'not_connected' | 'coming_soon' | 'error'
  configPath?: string
}

export default function IntegrationSettings() {
  const navigate = useNavigate()
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null)
  const [authnetStatus, setAuthnetStatus] = useState<AuthnetStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [stripe, authnet] = await Promise.all([
          stripeApi.getStatus().catch(() => null),
          authnetApi.getStatus().catch(() => null),
        ])
        setStripeStatus(stripe)
        setAuthnetStatus(authnet)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const integrations: IntegrationCard[] = [
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'Payment Processing',
      description: 'Accept payments and manage subscriptions',
      icon: <CreditCard className="h-5 w-5" />,
      status: stripeStatus?.connected ? 'connected' : 'not_connected',
      configPath: '/settings/payments',
    },
    {
      id: 'authnet',
      name: 'Authorize.net',
      category: 'Payment Processing',
      description: 'CIM profiles, ARB subscriptions, and one-time charges',
      icon: <CreditCard className="h-5 w-5" />,
      status: authnetStatus?.connected ? 'connected' : 'not_connected',
      configPath: '/settings/payments',
    },
    {
      id: 'twilio',
      name: 'Twilio',
      category: 'SMS / Texting',
      description: 'Send and receive text messages with leads and customers',
      icon: <MessageSquare className="h-5 w-5" />,
      status: 'not_connected',
    },
    {
      id: 'resend',
      name: 'Resend',
      category: 'Email',
      description: 'Send invoices, quotes, and sales emails',
      icon: <Mail className="h-5 w-5" />,
      status: 'not_connected',
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      category: 'Lead Generation',
      description: 'Auto-import leads from Google Ads forms',
      icon: <Megaphone className="h-5 w-5" />,
      status: 'not_connected',
    },
    {
      id: 'facebook',
      name: 'Facebook',
      category: 'Lead Generation',
      description: 'Auto-import leads from Facebook Lead Ads',
      icon: <Globe className="h-5 w-5" />,
      status: 'not_connected',
    },
    {
      id: 'google_calendar',
      name: 'Google Calendar',
      category: 'Calendar Sync',
      description: 'Two-way sync appointments and installs with Google Calendar',
      icon: <Calendar className="h-5 w-5" />,
      status: 'coming_soon',
    },
    {
      id: 'apple_calendar',
      name: 'Apple Calendar',
      category: 'Calendar Sync',
      description: 'Sync appointments with iCal via CalDAV',
      icon: <CalendarDays className="h-5 w-5" />,
      status: 'coming_soon',
    },
    {
      id: 'alarmcom',
      name: 'Alarm.com',
      category: 'Monitoring Platform',
      description: 'Sync customer accounts and equipment',
      icon: <Radio className="h-5 w-5" />,
      status: 'coming_soon',
    },
    {
      id: 'webhooks',
      name: 'Custom Webhooks',
      category: 'Lead Sources',
      description: 'Connect any lead source via webhooks',
      icon: <Webhook className="h-5 w-5" />,
      status: 'not_connected',
    },
  ]

  const statusBadge = (status: IntegrationCard['status']) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </span>
        )
      case 'not_connected':
        return (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Not Connected
          </span>
        )
      case 'coming_soon':
        return (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Coming Soon
          </span>
        )
      case 'error':
        return (
          <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
            Error
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-heading">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect third-party services to extend LSRV CRM</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="rounded-xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {integration.icon}
              </div>
              {statusBadge(integration.status)}
            </div>

            <h3 className="mt-3 text-sm font-semibold text-heading">{integration.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{integration.category}</p>
            <p className="mt-2 text-xs text-body">{integration.description}</p>

            <div className="mt-4">
              {integration.status === 'coming_soon' ? (
                <button
                  disabled
                  className="w-full rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground"
                >
                  Coming Soon
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (integration.configPath) {
                      navigate(integration.configPath)
                    }
                  }}
                  className="w-full rounded-lg border border-border px-4 py-2 text-xs font-medium text-heading hover:bg-page/50"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
