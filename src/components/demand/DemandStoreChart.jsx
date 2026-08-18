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

import "./styles/DemandStoreChart.css";

export default function DemandStoreChart({ data = [] }) {
  const storeData = {};

  data.forEach((item) => {
    const storeId = item.store_id;

    if (!storeId) {
      return;
    }

    if (!storeData[storeId]) {
      storeData[storeId] = {
        trueDemand: 0,
        salesQty: 0,
        count: 0,
      };
    }

    storeData[storeId].trueDemand +=
      Number(item.true_demand) || 0;

    storeData[storeId].salesQty +=
      Number(item.sales_qty) || 0;

    storeData[storeId].count += 1;
  });

  const chartData = Object.entries(storeData)
    .map(([storeId, value]) => {
      // STR_001 → 매장1
      // STR_002 → 매장2
      // STR_003 → 매장3
      // STR_004 → 매장4
      // STR_005 → 매장5
      const storeNumber = storeId.replace("STR_", "");

      return {
        storeId,

        storeName: `매장${Number(storeNumber)}`,

        trueDemand:
          value.count > 0
            ? Number(
                (value.trueDemand / value.count).toFixed(1)
              )
            : 0,

        salesQty:
          value.count > 0
            ? Number(
                (value.salesQty / value.count).toFixed(1)
              )
            : 0,
      };
    })
    .sort((a, b) => b.trueDemand - a.trueDemand);

  return (
    <section className="demand-store-chart">
      {/* 헤더 */}
      <div className="demand-store-chart__header">
        <div>
          <h3 className="demand-store-chart__title">
            매장별 수요 특성
          </h3>

          <p className="demand-store-chart__desc">
            매장별 평균 실제 수요와 판매량을 비교합니다.
          </p>
        </div>

        <span className="demand-store-chart__scenario">
          매장별 평균
        </span>
      </div>

      {/* 차트 */}
      <div className="demand-store-chart__body">
        {chartData.length === 0 ? (
          <div className="empty">
            매장별 수요 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 5,
                right: 15,
                left: 10,
                bottom: 5,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
              />

              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
              />

              <YAxis
                type="category"
                dataKey="storeName"
                width={60}
                tick={{ fontSize: 10 }}
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
                fill="#6366f1"
                radius={[0, 4, 4, 0]}
                barSize={12}
              />

              <Bar
                dataKey="salesQty"
                name="salesQty"
                fill="#cbd5e1"
                radius={[0, 4, 4, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 설명 */}
      <div className="demand-store-chart__footer">
        매장별 수요 차이를 비교하여 수요가 높은 매장과
        상대적으로 낮은 매장을 확인할 수 있습니다.
      </div>
    </section>
  );
}