import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import "./styles/DemandDefectChart.css";

export default function DemandDefectChart({ data = [] }) {
  let totalLostSales = 0;
  let totalSales = 0;
  let totalTrueDemand = 0;

  data.forEach((item) => {
    totalLostSales += Number(item.lost_sales_qty) || 0;
    totalSales += Number(item.sales_qty) || 0;
    totalTrueDemand += Number(item.true_demand) || 0;
  });

  const chartData = [
    {
      name: "수요",
      salesQty: Number(totalSales.toFixed(1)),
      lostSales: Number(totalLostSales.toFixed(1)),
      trueDemand: Number(totalTrueDemand.toFixed(1)),
    },
  ];

  const lossRate =
    totalTrueDemand > 0
      ? ((totalLostSales / totalTrueDemand) * 100).toFixed(1)
      : "0.0";

  return (
    <section className="demand-defect-chart">
      <div className="demand-defect-chart__header">
        <div>
          <h3 className="demand-defect-chart__title">
            결품과 수요 관계
          </h3>

          <p className="demand-defect-chart__desc">
            결품으로 발생한 손실 판매량과 실제 수요를 비교합니다.
          </p>
        </div>

        <span className="demand-defect-chart__scenario">
          결품 분석
        </span>
      </div>

      <div className="demand-defect-chart__body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 10,
              right: 10,
              left: 0,
              bottom: 5,
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
            />

            <YAxis
              tick={{ fontSize: 10 }}
              width={45}
            />

            <Tooltip
              formatter={(value, name) => {
                const label =
                  name === "trueDemand"
                    ? "실제 수요"
                    : name === "salesQty"
                    ? "판매량"
                    : "손실 판매량";

                return [
                  `${Number(value).toLocaleString()}개`,
                  label,
                ];
              }}
            />

            <Legend
              formatter={(value) => {
                if (value === "trueDemand") {
                  return "실제 수요";
                }

                if (value === "salesQty") {
                  return "판매량";
                }

                return "손실 판매량";
              }}
            />

            <Bar
              dataKey="trueDemand"
              name="trueDemand"
              fill="#7c3aed"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="salesQty"
              name="salesQty"
              fill="#94a3b8"
              radius={[4, 4, 0, 0]}
            />

            <Bar
              dataKey="lostSales"
              name="lostSales"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="demand-defect-chart__summary">
        <span>결품 손실률</span>

        <strong>{lossRate}%</strong>
      </div>

      <div className="demand-defect-chart__footer">
        실제 수요 대비 결품으로 놓친 판매 기회를 확인할 수 있습니다.
      </div>
    </section>
  );
}