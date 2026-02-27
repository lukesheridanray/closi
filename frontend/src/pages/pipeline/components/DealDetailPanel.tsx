import { differenceInDays, format } from 'date-fns'
import { Mail, Phone, MapPin } from 'lucide-react'
import type { DealWithContact, PipelineStage } from '@/types/pipeline'

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface DealDetailPanelProps {
  deal: DealWithContact
  stage: PipelineStage
}

export default function DealDetailPanel({ deal, stage }: DealDetailPanelProps) {
  const { contact } = deal
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at))

  return (
    <div className="space-y-6">
      {/* Contact + value header */}
      <div>
        <h3 className="text-xl font-bold text-heading">
          {contact.first_name} {contact.last_name}
        </h3>
        {contact.company && (
          <p className="mt-0.5 text-sm text-muted-foreground">{contact.company}</p>
        )}
        <p className="mt-2 text-2xl font-bold text-primary">
          {currencyFormat.format(deal.value)}
        </p>
      </div>

      {/* Stage badge */}
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
          style={{ backgroundColor: stage.color }}
        >
          {stage.name}
        </span>
      </div>

      {/* Deal info grid */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Deal Details
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Probability" value={`${deal.probability}%`} />
          <Field
            label="Expected Close"
            value={deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yyyy') : 'Not set'}
          />
          <Field label="Source" value={deal.source} />
          <Field label="Assigned To" value={deal.assigned_to ?? 'Unassigned'} />
          <Field label="Days in Stage" value={`${daysInStage} days`} />
          <Field label="Created" value={format(new Date(deal.created_at), 'MMM d, yyyy')} />
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-lg border border-border bg-page/50 p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contact Info
        </h4>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-body">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {contact.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-body">
            <Phone className="h-4 w-4 text-muted-foreground" />
            {contact.phone}
          </div>
          {contact.address && (
            <div className="flex items-start gap-2 text-sm text-body">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>
                {contact.address}
                {contact.city && `, ${contact.city}`}
                {contact.state && `, ${contact.state}`}
                {contact.zip && ` ${contact.zip}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {deal.notes && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h4>
          <p className="text-sm leading-relaxed text-body">{deal.notes}</p>
        </div>
      )}

      {/* Activity timeline placeholder */}
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </h4>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-border" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-border" />
                <div className="h-3 w-1/2 rounded bg-border" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-heading">{value}</dd>
    </div>
  )
}
