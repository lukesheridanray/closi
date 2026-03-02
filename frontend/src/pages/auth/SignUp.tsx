import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import api from '@/lib/api'
import useAuthStore from '@/stores/authStore'
import AuthLayout from '@/components/layout/AuthLayout'
import type { AuthResponse } from '@/types/auth'

const signUpSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
})

type SignUpForm = z.infer<typeof signUpSchema>

export default function SignUp() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  })

  const onSubmit = async (data: SignUpForm) => {
    setError(null)
    try {
      const response = await api.post<AuthResponse>('/auth/register', data)
      setAuth(response.data)
      navigate('/company-details')
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
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h2 className="text-[28px] font-semibold leading-tight text-heading">
          Create your account
        </h2>
        <p className="mt-3 text-sm text-heading">
          Get started with LSRV CRM in just a few steps.
        </p>

        {error && (
          <div className="mt-8 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="mt-12 space-y-8">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <label className="mb-2 block text-[13px] font-medium text-heading">
                First Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-0 bottom-3.5 size-[18px] text-placeholder" />
                <input
                  type="text"
                  placeholder="John"
                  autoComplete="given-name"
                  {...register('first_name')}
                  className="w-full border-0 border-b border-border bg-transparent pb-3 pl-7 pr-0 pt-1 text-[15px] text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
                />
              </div>
              {errors.first_name && (
                <p className="mt-2 text-xs text-danger">
                  {errors.first_name.message}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="mb-2 block text-[13px] font-medium text-heading">
                Last Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-0 bottom-3.5 size-[18px] text-placeholder" />
                <input
                  type="text"
                  placeholder="Doe"
                  autoComplete="family-name"
                  {...register('last_name')}
                  className="w-full border-0 border-b border-border bg-transparent pb-3 pl-7 pr-0 pt-1 text-[15px] text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
                />
              </div>
              {errors.last_name && (
                <p className="mt-2 text-xs text-danger">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-heading">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-0 bottom-3.5 size-[18px] text-placeholder" />
              <input
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('email')}
                className="w-full border-0 border-b border-border bg-transparent pb-3 pl-7 pr-0 pt-1 text-[15px] text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            {errors.email && (
              <p className="mt-2 text-xs text-danger">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-[13px] font-medium text-heading">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-0 bottom-3.5 size-[18px] text-placeholder" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                {...register('password')}
                className="w-full border-0 border-b border-border bg-transparent pb-3 pl-7 pr-9 pt-1 text-[15px] text-heading placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-0 bottom-3.5 text-placeholder transition-colors hover:text-body"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="size-[18px]" />
                ) : (
                  <Eye className="size-[18px]" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-2 text-xs text-danger">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit - 60% width, centered */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-3/5 rounded-xl bg-primary text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover hover:shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-heading">
          Already have an account?{' '}
          <Link
            to="/signin"
            className="font-medium text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
