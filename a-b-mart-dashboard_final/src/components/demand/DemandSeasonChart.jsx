import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import "./styles/DemandSeasonChart.css";


// seasonality 값을 월 이름으로 변환
function getMonthName(value) {
  const month = Number(value);

  const months = {
    1: "1월",
    2: "2월",
    3: "3월",
    4: "4월",
    5: "5월",
    6: "6월",
    7: "7월",
    8: "8월",
    9: "9월",
    10: "10월",
    11: "11월",
    12: "12월",
  };

  return months[month] || `${value}`;
}


export default function DemandSeasonChart({ data = [] }) {
  const seasonData = {};

  data.forEach((item) => {
    const month = Number(item.seasonality);

    if (!month || month < 1 || month > 12) {
      return;
    }

    if (!seasonData[month]) {
      seasonData[month] = {
        trueDemand: 0,
        salesQty: 0,
        count: 0,
      };
    }

    seasonData[month].trueDemand +=
      Number(item.true_demand) || 0;

    seasonData[month].salesQty +=
      Number(item.sales_qty) || 0;

    seasonData[month].count += 1;
  });


  const chartData = Object.entries(seasonData)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([month, value]) => ({
      month: getMonthName(month),

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
    }));


  return (
    <section className="demand-season-chart">

      {/* 헤더 */}
      <div className="demand-season-chart__header">
        <div>
          <h3 className="demand-season-chart__title">
            계절별 수요 특성
          </h3>

          <p className="demand-season-chart__desc">
            월별 평균 실제 수요와 판매량의 변화를 확인합니다.
          </p>
        </div>

        <span className="demand-season-chart__scenario">
          월별 평균
        </span>
      </div>


      {/* 차트 */}
      <div className="demand-season-chart__body">

        {chartData.length === 0 ? (
          <div className="empty">
            계절별 수요 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                dataKey="month"
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

              <Line
                type="monotone"
                dataKey="trueDemand"
                name="trueDemand"
                stroke="#7c3aed"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              <Line
                type="monotone"
                dataKey="salesQty"
                name="salesQty"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

            </LineChart>
          </ResponsiveContainer>
        )}

      </div>


      {/* 설명 */}
      <div className="demand-season-chart__footer">
        월별 수요 추이를 비교하여 계절에 따른 수요 변화를
        확인할 수 있습니다.
      </div>

    </section>
  );
}