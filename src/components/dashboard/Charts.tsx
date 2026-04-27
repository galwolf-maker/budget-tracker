import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import { CATEGORY_COLOR_MAP, CHART_PALETTE } from '../../constants/categories';
import type { CategoryDataPoint, MonthlyDataPoint } from '../../types';

interface ChartsProps {
  expensesByCategory: CategoryDataPoint[];
  monthlyData: MonthlyDataPoint[];
}

function getCategoryColor(name: string, index: number): string {
  return CATEGORY_COLOR_MAP[name] ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

interface BarPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface PiePayloadItem {
  name: string;
  value: number;
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: BarPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 px-3 py-2.5 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-sm min-w-[140px]">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }} className="font-medium">
            {entry.name}
          </span>
          <span className="text-slate-600 dark:text-slate-300">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: PiePayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{payload[0].name}</p>
      <p className="text-slate-500 dark:text-slate-400">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

const EmptyChart = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center justify-center h-52 gap-2">
    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl">
      📊
    </div>
    <p className="text-sm text-slate-400 dark:text-slate-500">{label}</p>
  </div>
);

export function Charts({ expensesByCategory, monthlyData }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
      {/* Expense Pie */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Expenses by Category
        </h3>
        {expensesByCategory.length === 0 ? (
          <EmptyChart label="No expense data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={expensesByCategory}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {expensesByCategory.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={getCategoryColor(entry.name, i)}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Monthly Overview
        </h3>
        {monthlyData.length === 0 ? (
          <EmptyChart label="No monthly data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyData} barGap={4} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--rc-grid)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--rc-tick)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--rc-tick)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
                }
                width={48}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--rc-cursor)' }} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">{value}</span>
                )}
              />
              <Bar
                dataKey="income"
                name="Income"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="#f43f5e"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
