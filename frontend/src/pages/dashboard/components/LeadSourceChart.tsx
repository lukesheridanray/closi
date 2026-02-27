import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

interface LeadSourceData {
  source: string;
  count: number;
  value: number;
}

interface LeadSourceChartProps {
  data: LeadSourceData[];
}

const COLORS = [
  "#6C63FF",
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#F97316",
  "#EF4444",
  "#8B5CF6",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: LeadSourceData;
  }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const { source, count, value } = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-foreground">{source}</p>
      <p className="text-xs text-muted-foreground">
        {count} {count === 1 ? "lead" : "leads"}
      </p>
      <p className="text-xs font-medium text-foreground">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export default function LeadSourceChart({ data }: LeadSourceChartProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-card">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Lead Source Performance
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="source"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
