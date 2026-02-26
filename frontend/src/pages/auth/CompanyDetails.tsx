import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import useAuthStore from '@/stores/authStore'
import type { Organization } from '@/types/auth'

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

const companyDetailsSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  timezone: z.string().optional(),
})

type CompanyDetailsForm = z.infer<typeof companyDetailsSchema>

export default function CompanyDetails() {
  const navigate = useNavigate()
  const updateOrganization = useAuthStore((s) => s.updateOrganization)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyDetailsForm>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: {
      timezone: 'America/New_York',
    },
  })

  const onSubmit = async (data: CompanyDetailsForm) => {
    setError(null)
    try {
      const response = await api.put<Organization>('/auth/company-details', data)
      updateOrganization(response.data)
      navigate('/')
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'detail' in err.response.data
      ) {
        setError(String((err.response as { data: { detail: unknown } }).data.detail))
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-lg">
        <h2 className="mb-2 text-2xl font-bold text-heading">
          Set up your company
        </h2>
        <p className="mb-8 text-sm text-body">
          Tell us about your business so we can personalize your experience.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-body">
              Company Name
            </label>
            <input
              type="text"
              placeholder="Acme Solar Inc."
              {...register('name')}
              className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-xs font-medium text-body">
              Phone
            </label>
            <input
              type="tel"
              placeholder="(555) 123-4567"
              {...register('phone')}
              className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
            />
          </div>

          {/* Address */}
          <div>
            <label className="mb-1 block text-xs font-medium text-body">
              Address Line 1
            </label>
            <input
              type="text"
              placeholder="123 Main Street"
              {...register('address_line1')}
              className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
            />
          </div>

          {/* City, State, Zip - 3 columns */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-body">
                City
              </label>
              <input
                type="text"
                placeholder="New York"
                {...register('city')}
                className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-body">
                State
              </label>
              <input
                type="text"
                placeholder="NY"
                {...register('state')}
                className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-body">
                Zip
              </label>
              <input
                type="text"
                placeholder="10001"
                {...register('zip')}
                className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="mb-1 block text-xs font-medium text-body">
              Timezone
            </label>
            <select
              {...register('timezone')}
              className="w-full border-0 border-b border-border bg-transparent py-3 px-0 text-sm text-heading focus:border-primary focus:outline-none focus:ring-0"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 w-full min-w-[120px] rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Complete Setup'}
          </button>
        </form>

        <p className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-body hover:text-heading"
          >
            Skip for now
          </button>
        </p>
      </div>
    </div>
  )
}
