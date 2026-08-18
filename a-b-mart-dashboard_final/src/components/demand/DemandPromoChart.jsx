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

import "./styles/DemandPromoChart.css";

export default function DemandPromoChart({ data = [] }) {
  const promotionData = [
    {
      name: "프로모션 미적용",
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },
    {
      name: "프로모션 적용",
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },
  ];

  data.forEach((item) => {
    const isPromotion =
      item.promotion_flag === true ||
      item.promotion_flag === 1 ||
      item.promotion_flag === "true" ||
      item.promotion_flag === "1";

    const target = isPromotion
      ? promotionData[1]
      : promotionData[0];

    const trueDemand = Number(item.true_demand) || 0;
    const salesQty = Number(item.sales_qty) || 0;

    target.trueDemand += trueDemand;
    target.salesQty += salesQty;
    target.count += 1;
  });

  const chartData = promotionData.map((item) => ({
    name: item.name,

    trueDemand:
      item.count > 0
        ? Number((item.trueDemand / item.count).toFixed(1))
        : 0,

    salesQty:
      item.count > 0
        ? Number((item.salesQty / item.count).toFixed(1))
        : 0,
  }));

  return (
    <section className="demand-promo-chart">
      <div className="demand-promo-chart__header">
        <div>
          <h3 className="demand-promo-chart__title">
            프로모션 여부에 따른 수요
          </h3>

          <p className="demand-promo-chart__desc">
            프로모션 적용 여부에 따른 평균 실제 수요와 판매량을 비교합니다.
          </p>
        </div>

        <span className="demand-promo-chart__scenario">
          평균 수요 기준
        </span>
      </div>

      <div className="demand-promo-chart__body">
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
              formatter={(value, name) => [
                `${Number(value).toLocaleString()}개`,
                name === "trueDemand"
                  ? "실제 수요"
                  : "판매량",
              ]}
            />

            <Legend
              formatter={(value) =>
                value === "trueDemand"
                  ? "실제 수요"
                  : "판매량"
              }
            />

            <Bar
              dataKey="trueDemand"
              name="trueDemand"
              fill="#7c3aed"
              radius={[4, 4, 0, 0]}
              barSize={24}
            />

            <Bar
              dataKey="salesQty"
              name="salesQty"
              fill="#94a3b8"
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="demand-promo-chart__footer">
        실제 수요는 잠재 수요를 포함한 수요량이며,
        판매량과 비교하여 프로모션 효과를 확인할 수 있습니다.
      </div>
    </section>
  );
}