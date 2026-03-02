import type { ReactNode } from 'react'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen">
      {/* Left side - form */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-8 py-16 md:w-1/2 md:px-20 lg:px-28">
        {children}
      </div>

      {/* Right side - branding with geometric shapes */}
      <div
        className="relative hidden w-1/2 flex-col items-center justify-center overflow-hidden md:flex"
        style={{
          background: 'linear-gradient(135deg, #6C63FF, #4B6CB7)',
        }}
      >
        {/* Abstract geometric shapes */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 600 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Large ring top-right */}
          <circle cx="480" cy="120" r="140" stroke="white" strokeOpacity="0.08" strokeWidth="60" />
          {/* Small filled circle */}
          <circle cx="100" cy="200" r="24" fill="white" fillOpacity="0.06" />
          {/* Medium ring center-left */}
          <circle cx="80" cy="500" r="90" stroke="white" strokeOpacity="0.06" strokeWidth="40" />
          {/* Rounded rectangle top-left */}
          <rect x="60" y="60" width="120" height="120" rx="24" stroke="white" strokeOpacity="0.05" strokeWidth="2" transform="rotate(15 120 120)" />
          {/* Dots cluster */}
          <circle cx="450" cy="650" r="6" fill="white" fillOpacity="0.12" />
          <circle cx="470" cy="670" r="4" fill="white" fillOpacity="0.08" />
          <circle cx="440" cy="680" r="5" fill="white" fillOpacity="0.10" />
          <circle cx="460" cy="700" r="3" fill="white" fillOpacity="0.06" />
          {/* Large soft rectangle bottom-right */}
          <rect x="400" y="350" width="200" height="200" rx="40" stroke="white" strokeOpacity="0.05" strokeWidth="2" transform="rotate(-10 500 450)" />
          {/* Floating pill shapes */}
          <rect x="350" y="200" width="80" height="24" rx="12" fill="white" fillOpacity="0.06" transform="rotate(25 390 212)" />
          <rect x="150" y="650" width="60" height="18" rx="9" fill="white" fillOpacity="0.05" transform="rotate(-15 180 659)" />
          {/* Thin diagonal line */}
          <line x1="200" y1="300" x2="380" y2="180" stroke="white" strokeOpacity="0.04" strokeWidth="1" />
          {/* Small diamond */}
          <rect x="500" cy="500" width="30" height="30" rx="4" fill="white" fillOpacity="0.07" transform="rotate(45 515 515)" y="500" />
        </svg>

        {/* Content */}
        <div className="relative z-10 max-w-sm px-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-white">
            LSRV CRM
          </h1>
          <p className="mb-8 text-base leading-relaxed text-white/70">
            The modern CRM built for home service businesses. Manage leads, close deals, and grow your revenue.
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-1 w-8 rounded-full bg-white/30" />
            <div className="h-1 w-8 rounded-full bg-white/15" />
            <div className="h-1 w-8 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </div>
  )
}
