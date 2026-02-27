import type { CRMField, ScrubResult, ColumnMapping } from './csvImport'
import {
  normalizePhone,
  normalizeEmail,
  normalizeName,
  normalizeState,
  normalizeLeadSource,
  mapColumns as baseMapColumns,
  scrubRows as baseScrubRows,
} from './csvImport'

// --- Deal + Contact CRM fields for CSV import ---

export const DEAL_CRM_FIELDS: CRMField[] = [
  // Contact fields
  { key: 'first_name', label: 'First Name', aliases: ['first', 'firstname', 'fname', 'first name', 'given name', 'givenname'], required: true },
  { key: 'last_name', label: 'Last Name', aliases: ['last', 'lastname', 'lname', 'last name', 'surname', 'family name', 'familyname'], required: true },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'email address', 'e-mail', 'mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phonenumber', 'phone number', 'telephone', 'tel', 'mobile', 'cell', 'cellphone', 'cell phone'] },
  { key: 'company', label: 'Company', aliases: ['company', 'companyname', 'company name', 'organization', 'org', 'business', 'business name'] },
  { key: 'address', label: 'Address', aliases: ['address', 'street', 'streetaddress', 'street address', 'address1', 'address line 1'] },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'state', label: 'State', aliases: ['state', 'province', 'region', 'st'] },
  { key: 'zip', label: 'ZIP', aliases: ['zip', 'zipcode', 'zip code', 'postalcode', 'postal code', 'postal'] },
  { key: 'lead_source', label: 'Lead Source', aliases: ['leadsource', 'lead source', 'source', 'lead origin', 'origin'] },
  // Deal fields
  { key: 'title', label: 'Title', aliases: ['title', 'deal title', 'lead title', 'deal name', 'lead name', 'name', 'subject', 'opportunity', 'job name', 'project name'], required: true },
  { key: 'estimated_value', label: 'Estimated Value', aliases: ['value', 'amount', 'deal value', 'estimated value', 'price', 'revenue', 'worth', 'deal amount', 'lead value'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'comments', 'description', 'memo', 'remarks', 'details'] },
  { key: 'expected_close_date', label: 'Expected Close Date', aliases: ['close date', 'closedate', 'expected close', 'expected close date', 'close by', 'due date'] },
]

// --- Field sets ---

export const CONTACT_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'company',
  'address', 'city', 'state', 'zip', 'lead_source',
])

export const DEAL_FIELDS = new Set([
  'title', 'estimated_value', 'notes', 'expected_close_date',
])

// --- Validation ---

export function validateDealRow(row: ScrubResult): { valid: boolean; errors: string[] } {
  const errs: string[] = []
  const { data } = row

  const hasName = data.first_name?.trim() || data.last_name?.trim()
  if (!hasName) errs.push('Missing name (first or last name required)')

  if (!data.title?.trim()) errs.push('Missing title (required)')

  return { valid: errs.length === 0, errors: errs }
}

// Re-export for convenience
export { parseCSV, mapColumns, scrubRows, findDuplicates, generateFailedCSV } from './csvImport'
export { normalizePhone, normalizeEmail, normalizeName, normalizeState, normalizeLeadSource }
export type { ColumnMapping, ScrubResult }

// --- Custom mapColumns using DEAL_CRM_FIELDS ---

export function mapDealColumns(
  headers: string[],
  sampleRows: string[][],
): ColumnMapping[] {
  // Use the base mapColumns logic but with DEAL_CRM_FIELDS
  // We need to replicate the matching logic since base uses CRM_FIELDS internally
  const normalize = (str: string): string =>
    str.toLowerCase().replace(/[_\-.\s]/g, '')

  const usedFields = new Set<string>()

  return headers.map((header, colIdx) => {
    const normalized = normalize(header)
    let matchedField: string | null = null
    let confidence: 'high' | 'medium' | 'low' = 'low'

    // Check against alias lists
    for (const field of DEAL_CRM_FIELDS) {
      if (usedFields.has(field.key)) continue
      const normalizedAliases = field.aliases.map(normalize)
      if (normalizedAliases.includes(normalized) || normalize(field.key) === normalized) {
        matchedField = field.key
        confidence = 'high'
        break
      }
    }

    // Pattern detection for unmapped columns
    if (!matchedField) {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const PHONE_REGEX = /^[\d()\s\-+.]{7,}$/
      const CURRENCY_REGEX = /^\$?[\d,.]+$/

      const samples = sampleRows
        .map((row) => row[colIdx] ?? '')
        .filter((v) => v.trim() !== '')
        .slice(0, 10)

      if (samples.length > 0) {
        const ratio = (count: number) => count / samples.length
        const emailCount = samples.filter((v) => EMAIL_REGEX.test(v)).length
        const phoneCount = samples.filter((v) => PHONE_REGEX.test(v)).length
        const currencyCount = samples.filter((v) => CURRENCY_REGEX.test(v.replace(/[$,]/g, ''))).length

        if (ratio(emailCount) > 0.5 && !usedFields.has('email')) {
          matchedField = 'email'
          confidence = 'medium'
        } else if (ratio(phoneCount) > 0.5 && !usedFields.has('phone')) {
          matchedField = 'phone'
          confidence = 'medium'
        } else if (ratio(currencyCount) > 0.5 && !usedFields.has('estimated_value')) {
          matchedField = 'estimated_value'
          confidence = 'low'
        }
      }
    }

    if (matchedField) usedFields.add(matchedField)

    const sampleValue = sampleRows
      .map((row) => row[colIdx] ?? '')
      .find((v) => v.trim() !== '') ?? ''

    return { csvHeader: header, crmField: matchedField, confidence, sampleValue }
  })
}

// --- Custom scrubRows for deal fields ---

export function scrubDealRows(
  rows: string[][],
  mappings: ColumnMapping[],
): ScrubResult[] {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
        case 'estimated_value': {
          // Strip $ and commas, parse as number
          const cleaned = value.replace(/[$,]/g, '').trim()
          const num = parseFloat(cleaned)
          value = isNaN(num) ? '0' : String(num)
          break
        }
      }

      data[field] = value
    })

    let status: ScrubResult['status'] = 'clean'
    if (errors.length > 0) status = 'error'
    else if (warnings.length > 0) status = 'warning'

    return { data, warnings, errors, status }
  })
}
