import type { Contact, LeadSource, ContactStatus } from '@/types/contact'
import { LEAD_SOURCE_LABELS } from '@/types/contact'

// --- Types ---

export interface ColumnMapping {
  csvHeader: string
  crmField: string | null
  confidence: 'high' | 'medium' | 'low'
  sampleValue: string
}

export interface ScrubResult {
  data: Record<string, string>
  warnings: string[]
  errors: string[]
  status: 'clean' | 'warning' | 'error'
}

export interface ImportOptions {
  duplicateAction: 'skip' | 'update' | 'create'
  leadSourceOverride: LeadSource | null
  assignedToOverride: string | null
  autoCreateDeals: boolean
  defaultStageId: string
  defaultDealValue: number
}

export interface CRMField {
  key: string
  label: string
  aliases: string[]
  required?: boolean
}

// --- CRM Fields ---

export const CRM_FIELDS: CRMField[] = [
  { key: 'first_name', label: 'First Name', aliases: ['first', 'firstname', 'fname', 'first name', 'given name', 'givenname'], required: true },
  { key: 'last_name', label: 'Last Name', aliases: ['last', 'lastname', 'lname', 'last name', 'surname', 'family name', 'familyname'], required: true },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'email address', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phonenumber', 'phone number', 'telephone', 'tel', 'mobile', 'cell', 'cellphone', 'cell phone'] },
  { key: 'company', label: 'Company', aliases: ['company', 'companyname', 'company name', 'organization', 'org', 'business', 'business name'] },
  { key: 'address', label: 'Address', aliases: ['address', 'street', 'streetaddress', 'street address', 'address1', 'address line 1'] },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'state', label: 'State', aliases: ['state', 'province', 'region', 'st'] },
  { key: 'zip', label: 'ZIP', aliases: ['zip', 'zipcode', 'zip code', 'postalcode', 'postal code', 'postal'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['leadsource', 'lead source', 'source', 'lead origin', 'origin', 'how heard', 'how did you hear'] },
  { key: 'status', label: 'Status', aliases: ['status', 'contact status', 'contactstatus', 'lead status'] },
  { key: 'property_type', label: 'Property Type', aliases: ['propertytype', 'property type', 'property', 'dwelling', 'dwelling type'] },
  { key: 'assigned_to', label: 'Assigned To', aliases: ['assignedto', 'assigned to', 'rep', 'representative', 'sales rep', 'salesperson', 'owner'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels', 'categories'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'comments', 'description', 'memo', 'remarks'] },
]

// --- CSV Parsing ---

export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (char === '"') {
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          fields.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
    }
    fields.push(current.trim())
    return fields
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)

  return { headers, rows }
}

// --- Column Mapping ---

function normalize(str: string): string {
  return str.toLowerCase().replace(/[_\-.\s]/g, '')
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[\d()\s\-+.]{7,}$/
const ZIP_REGEX = /^\d{5}(-\d{4})?$/
const STATE_ABBREVS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

const STATE_NAMES: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
}

const LEAD_SOURCE_MAP: Record<string, LeadSource> = {
  'google': 'google_ads', 'google ads': 'google_ads', 'googleads': 'google_ads', 'ppc': 'google_ads', 'adwords': 'google_ads',
  'referral': 'referral', 'referred': 'referral', 'word of mouth': 'referral',
  'website': 'website', 'web': 'website', 'online': 'website', 'internet': 'website',
  'cold call': 'cold_call', 'coldcall': 'cold_call', 'outbound': 'cold_call',
  'door knock': 'door_knock', 'doorknock': 'door_knock', 'door to door': 'door_knock', 'd2d': 'door_knock',
  'partner': 'partner', 'dealer': 'partner', 'affiliate': 'partner',
  'other': 'other',
}

export function mapColumns(
  headers: string[],
  sampleRows: string[][],
): ColumnMapping[] {
  const usedFields = new Set<string>()

  return headers.map((header, colIdx) => {
    const normalized = normalize(header)
    let matchedField: string | null = null
    let confidence: 'high' | 'medium' | 'low' = 'low'

    // 1. Check against alias lists
    for (const field of CRM_FIELDS) {
      if (usedFields.has(field.key)) continue
      const normalizedAliases = field.aliases.map(normalize)
      if (normalizedAliases.includes(normalized) || normalize(field.key) === normalized) {
        matchedField = field.key
        confidence = 'high'
        break
      }
    }

    // 2. If no name match, scan sample data for patterns
    if (!matchedField) {
      const samples = sampleRows
        .map((row) => row[colIdx] ?? '')
        .filter((v) => v.trim() !== '')
        .slice(0, 10)

      if (samples.length > 0) {
        const emailCount = samples.filter((v) => EMAIL_REGEX.test(v)).length
        const phoneCount = samples.filter((v) => PHONE_REGEX.test(v)).length
        const zipCount = samples.filter((v) => ZIP_REGEX.test(v)).length
        const stateCount = samples.filter((v) => STATE_ABBREVS.has(v.toUpperCase()) || STATE_NAMES[v.toLowerCase()]).length
        const sourceCount = samples.filter((v) => LEAD_SOURCE_MAP[v.toLowerCase()]).length

        const ratio = (count: number) => count / samples.length

        if (ratio(emailCount) > 0.5 && !usedFields.has('email')) {
          matchedField = 'email'
          confidence = 'medium'
        } else if (ratio(phoneCount) > 0.5 && !usedFields.has('phone')) {
          matchedField = 'phone'
          confidence = 'medium'
        } else if (ratio(stateCount) > 0.5 && !usedFields.has('state')) {
          matchedField = 'state'
          confidence = 'medium'
        } else if (ratio(zipCount) > 0.5 && !usedFields.has('zip')) {
          matchedField = 'zip'
          confidence = 'medium'
        } else if (ratio(sourceCount) > 0.3 && !usedFields.has('lead_source')) {
          matchedField = 'lead_source'
          confidence = 'low'
        }
      }
    }

    if (matchedField) usedFields.add(matchedField)

    // Extract first non-empty sample
    const sampleValue = sampleRows
      .map((row) => row[colIdx] ?? '')
      .find((v) => v.trim() !== '') ?? ''

    return { csvHeader: header, crmField: matchedField, confidence, sampleValue }
  })
}

// --- Normalizers ---

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1)
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return value
}

export function normalizeEmail(value: string): string {
  return value.toLowerCase().trim()
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function normalizeState(value: string): string {
  const upper = value.trim().toUpperCase()
  if (STATE_ABBREVS.has(upper)) return upper
  const mapped = STATE_NAMES[value.trim().toLowerCase()]
  if (mapped) return mapped
  return value.trim()
}

export function normalizeLeadSource(value: string): LeadSource {
  const lower = value.toLowerCase().trim()
  if (LEAD_SOURCE_MAP[lower]) return LEAD_SOURCE_MAP[lower]
  // Check if it's already a valid key
  if (Object.keys(LEAD_SOURCE_LABELS).includes(lower)) return lower as LeadSource
  return 'other'
}

// --- Scrubbing ---

export function scrubRows(
  rows: string[][],
  mappings: ColumnMapping[],
): ScrubResult[] {
  return rows.map((row) => {
    const data: Record<string, string> = {}
    const warnings: string[] = []
    const errors: string[] = []

    mappings.forEach((mapping, colIdx) => {
      if (!mapping.crmField) return
      const raw = row[colIdx] ?? ''
      const field = mapping.crmField

      let value = raw.trim()
      if (!value) return

      switch (field) {
        case 'phone': {
          const normalized = normalizePhone(value)
          const digits = normalized.replace(/\D/g, '')
          if (digits.length !== 10) {
            warnings.push(`Phone "${value}" is not 10 digits`)
          }
          value = normalized
          break
        }
        case 'email': {
          value = normalizeEmail(value)
          if (!EMAIL_REGEX.test(value)) {
            errors.push(`Invalid email: "${value}"`)
          }
          break
        }
        case 'first_name':
        case 'last_name':
          value = normalizeName(value)
          break
        case 'state':
          value = normalizeState(value)
          break
        case 'lead_source':
          value = normalizeLeadSource(value)
          break
        case 'zip':
          if (!ZIP_REGEX.test(value)) {
            warnings.push(`ZIP "${value}" may be invalid`)
          }
          break
      }

      data[field] = value
    })

    let status: ScrubResult['status'] = 'clean'
    if (errors.length > 0) status = 'error'
    else if (warnings.length > 0) status = 'warning'

    return { data, warnings, errors, status }
  })
}

// --- Validation ---

export function validateRow(row: ScrubResult): { valid: boolean; errors: string[] } {
  const errs: string[] = []
  const { data } = row

  const hasName = (data.first_name?.trim() || data.last_name?.trim())
  if (!hasName) errs.push('Missing name (first or last name required)')

  const hasContact = (data.email?.trim() || data.phone?.trim())
  if (!hasContact) errs.push('Missing contact info (email or phone required)')

  if (data.email && !EMAIL_REGEX.test(data.email)) {
    errs.push(`Invalid email format: "${data.email}"`)
  }

  if (data.phone) {
    const digits = data.phone.replace(/\D/g, '')
    if (digits.length !== 10) {
      errs.push(`Phone should be 10 digits, got ${digits.length}`)
    }
  }

  return { valid: errs.length === 0, errors: errs }
}

// --- Duplicate Detection ---

export function findDuplicates(
  scrubbedRows: ScrubResult[],
  existingContacts: Contact[],
): Map<number, Contact> {
  const emailMap = new Map<string, Contact>()
  const phoneMap = new Map<string, Contact>()

  for (const contact of existingContacts) {
    if (contact.email) {
      emailMap.set(contact.email.toLowerCase(), contact)
    }
    if (contact.phone) {
      phoneMap.set(contact.phone.replace(/\D/g, ''), contact)
    }
  }

  const duplicates = new Map<number, Contact>()

  scrubbedRows.forEach((row, idx) => {
    const email = row.data.email?.toLowerCase()
    if (email && emailMap.has(email)) {
      duplicates.set(idx, emailMap.get(email)!)
      return
    }

    const phone = row.data.phone?.replace(/\D/g, '')
    if (phone && phone.length === 10 && phoneMap.has(phone)) {
      duplicates.set(idx, phoneMap.get(phone)!)
    }
  })

  return duplicates
}

// --- Failed CSV Generation ---

export function generateFailedCSV(
  headers: string[],
  failedRows: { row: string[]; reason: string }[],
): string {
  const csvHeaders = [...headers, 'Failure Reason']
  const lines = [csvHeaders.join(',')]

  for (const { row, reason } of failedRows) {
    const escaped = [...row, reason].map((val) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    })
    lines.push(escaped.join(','))
  }

  return lines.join('\n')
}

// --- Build Contact from scrub result ---

export function buildContact(
  data: Record<string, string>,
  options: ImportOptions,
): Omit<Contact, 'id' | 'org_id' | 'created_at' | 'updated_at'> {
  const leadSource: LeadSource =
    options.leadSourceOverride ??
    (data.lead_source as LeadSource) ??
    'other'

  const status: ContactStatus =
    (data.status as ContactStatus) ?? 'new'

  return {
    first_name: data.first_name ?? '',
    last_name: data.last_name ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    company: data.company || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zip: data.zip || null,
    lead_source: leadSource,
    status,
    property_type: null,
    assigned_to: options.assignedToOverride ?? data.assigned_to ?? null,
    tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    notes: data.notes ?? '',
  }
}
