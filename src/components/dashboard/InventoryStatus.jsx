import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

import { getInventoryStatus } from "../../utils/dashboard";
import "./styles/InventoryStatus.css";

const COLORS = {
  부족: "#EF4444",
  적정: "#22C55E",
  과잉: "#F59E0B",
};

export default function InventoryStatus({ data }) {
  const chartData = getInventoryStatus(data);

  // 전체 재고 상태 합계
  const total = chartData.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0
  );

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>재고 상태 분포</h2>
          <p>현재 재고와 재주문점·안전재고를 비교합니다.</p>
        </div>
      </div>

      <div className="inventory-chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name]}
                />
              ))}
            </Pie>

            {/* 가운데 전체 수량 */}
            <text
              x="50%"
              y="43%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="inventory-total-value"
            >
              {total.toLocaleString()}
            </text>

            <text
              x="50%"
              y="52%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="inventory-total-label"
            >
              전체 재고
            </text>

            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toLocaleString()}개`,
                name,
              ]}
            />

            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="inventory-legend-text">
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}