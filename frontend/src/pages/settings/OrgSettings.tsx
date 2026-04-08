import { useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, CreditCard, Package, PlugZap, Users } from 'lucide-react'

interface SettingsCard {
  title: string
  description: string
  path: string
  icon: React.ReactNode
}

const settingsCards: SettingsCard[] = [
  {
    title: 'Payment Settings',
    description: 'Connect Authorize.net, manage billing configuration, and verify webhook readiness.',
    path: '/settings/payments',
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    title: 'Product Catalog',
    description: 'Manage equipment, services, and monitoring plans used in quotes.',
    path: '/settings/products',
    icon: <Package className="h-5 w-5" />,
  },
  {
    title: 'Integrations',
    description: 'Configure lead sources, messaging tools, email providers, and third-party services.',
    path: '/settings/integrations',
    icon: <PlugZap className="h-5 w-5" />,
  },
  {
    title: 'Organization',
    description: 'Manage business identity, branding, and account-wide defaults as this area fills out.',
    path: '/settings',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    title: 'Team',
    description: 'Invite teammates, assign roles, and control who can access billing and operations.',
    path: '/settings/team',
    icon: <Users className="h-5 w-5" />,
  },
]

export default function OrgSettings() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the core systems that run LSRV CRM, from billing and integrations to workflow setup.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {settingsCards.map((card) => (
          <button
            key={card.title}
            onClick={() => navigate(card.path)}
            className="group rounded-xl border border-border bg-white p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {card.icon}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>

            <h2 className="mt-4 text-sm font-semibold text-heading">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
