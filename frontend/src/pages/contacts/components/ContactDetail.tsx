import { format } from 'date-fns'
import { ArrowLeft, Mail, Phone, MapPin, Edit } from 'lucide-react'
import type { Contact } from '@/types/contact'
import type { Activity } from '@/types/contact'
import {
  LEAD_SOURCE_LABELS,
  CONTACT_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
} from '@/types/contact'
import useContactStore from '@/stores/contactStore'
import usePipelineStore from '@/stores/pipelineStore'
import ActivityTimeline from './ActivityTimeline'
import QuickActions from './QuickActions'

const statusColors: Record<string, string> = {
  new: 'bg-info/10 text-info',
  active: 'bg-success/10 text-success',
  customer: 'bg-primary/10 text-primary',
  inactive: 'bg-muted text-muted-foreground',
  lost: 'bg-danger/10 text-danger',
}

interface ContactDetailProps {
  contact: Contact
  onBack: () => void
}

export default function ContactDetail({ contact, onBack }: ContactDetailProps) {
  const activities = useContactStore((s) => s.activities)
  const deals = usePipelineStore((s) => s.deals)
  const stages = usePipelineStore((s) => s.stages)

  const contactActivities = activities.filter((a) => a.contact_id === contact.id)
  const contactDeals = deals.filter((d) => d.contact_id === contact.id)

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-body"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:bg-page">
          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          Edit
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Left column: static info */}
        <div className="space-y-4">
          {/* Contact header card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-heading">
                  {contact.first_name} {contact.last_name}
                </h2>
                {contact.company && (
                  <p className="mt-0.5 text-sm text-muted-foreground">{contact.company}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  statusColors[contact.status] ?? statusColors.active
                }`}
              >
                {CONTACT_STATUS_LABELS[contact.status]}
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
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

            {/* Meta fields */}
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4">
              <Field label="Owner" value={contact.assigned_to ?? 'Unassigned'} />
              <Field label="Source" value={LEAD_SOURCE_LABELS[contact.lead_source]} />
              <Field
                label="Property"
                value={contact.property_type ? PROPERTY_TYPE_LABELS[contact.property_type] : 'N/A'}
              />
              <Field label="Created" value={format(new Date(contact.created_at), 'MMM d, yyyy')} />
            </div>

            {/* Tags */}
            {contact.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Deals card */}
          <div className="rounded-xl border border-border bg-white p-5 shadow-card">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deals
            </h3>
            {contactDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals</p>
            ) : (
              <div className="space-y-2">
                {contactDeals.map((deal) => {
                  const stage = stages.find((s) => s.id === deal.stage_id)
                  return (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-heading">{deal.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {stage && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                              style={{ backgroundColor: stage.color }}
                            >
                              {stage.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        ${deal.value.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notes card */}
          {contact.notes && (
            <div className="rounded-xl border border-border bg-white p-5 shadow-card">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notes
              </h3>
              <p className="text-sm leading-relaxed text-body">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: activity timeline */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activity Timeline
            </h3>
          </div>

          {/* Quick actions */}
          <div className="mb-5">
            <QuickActions contactId={contact.id} />
          </div>

          <ActivityTimeline activities={contactActivities} />
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
