import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useEntityLabels } from '@/hooks/useEntityLabels'

interface Stage {
  name: string
  color: string
  count: number
  value: number
}

interface PipelineStageChartProps {
  stages: Stage[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: Stage }[]
  label?: string
  dealSingularLower?: string
  dealPluralLower?: string
}

function CustomTooltip({ active, payload, dealSingularLower = 'deal', dealPluralLower = 'deals' }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const stage = payload[0].payload

  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-card">
      <p className="text-sm font-semibold text-foreground">{stage.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatCurrency(stage.value)}
      </p>
      <p className="text-sm text-muted-foreground">
        {stage.count} {stage.count === 1 ? dealSingularLower : dealPluralLower}
      </p>
    </div>
  )
}

export default function PipelineStageChart({ stages }: PipelineStageChartProps) {
  const { deal: dealLabel } = useEntityLabels()
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline by Stage
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={stages} layout="vertical">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 13 }}
          />
          <Tooltip content={<CustomTooltip dealSingularLower={dealLabel.singularLower} dealPluralLower={dealLabel.pluralLower} />} cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
            {stages.map((stage, index) => (
              <Cell key={`cell-${index}`} fill={stage.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
