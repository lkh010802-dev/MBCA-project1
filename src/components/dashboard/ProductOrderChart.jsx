import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { getProductChartData } from "../../utils/dashboard";
import { getProductName } from "../../utils/formatters";
import "./styles/ProductOrderChart.css";

export default function ProductOrderChart({ data }) {
  const rawChartData = getProductChartData(data);

  const chartData = rawChartData.map((item) => ({
    ...item,
    product_id: getProductName(item.product_id),
  }));

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>상품별 발주 필요 근거</h2>
          <p>예측수요·리드타임 수요·권장 발주량 비교</p>
        </div>
      </div>

      <div className="product-order-chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 4,
              right: 8,
              left: 0,
              bottom: 42,
            }}
            barCategoryGap="18%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />

            {/* X축 */}
            <XAxis
              dataKey="product_id"
              interval={0}
              angle={-25}
              textAnchor="end"
              height={52}
              tick={{
                fontSize: 9,
                fill: "#64748b",
              }}
              axisLine={{
                stroke: "#cbd5e1",
              }}
              tickLine={false}
            />

            {/* Y축 */}
            <YAxis
              width={52}
              tick={{
                fontSize: 9,
                fill: "#64748b",
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              formatter={(value) =>
                `${Number(value).toLocaleString()}개`
              }
              contentStyle={{
                fontSize: "10px",
                borderRadius: "7px",
                border: "1px solid #e2e8f0",
                boxShadow:
                  "0 4px 12px rgba(15, 23, 42, 0.08)",
              }}
            />

            <Legend
              verticalAlign="bottom"
              align="center"
              height={24}
              iconSize={10}
              wrapperStyle={{
                fontSize: "10px",
                paddingTop: "2px",
              }}
            />

            <Bar
              dataKey="predicted_demand"
              name="예측수요"
              fill="#3B82F6"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
            />

            <Bar
              dataKey="lead_time_demand"
              name="리드타임 수요"
              fill="#F59E0B"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
            />

            <Bar
              dataKey="order_qty_90"
              name="권장발주량"
              fill="#8B5CF6"
              radius={[2, 2, 0, 0]}
              maxBarSize={12}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}