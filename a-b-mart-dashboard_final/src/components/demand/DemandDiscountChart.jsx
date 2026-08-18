import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import "./styles/DemandDiscountChart.css";


// 할인율을 화면에서 사용할 구간으로 변환
function getDiscountGroup(discount) {
  const value = Number(discount) || 0;

  if (value === 0) {
    return "0%";
  }

  if (value <= 10) {
    return "1~10%";
  }

  if (value <= 20) {
    return "11~20%";
  }

  if (value <= 30) {
    return "21~30%";
  }

  if (value <= 40) {
    return "31~40%";
  }

  return "41% 이상";
}


export default function DemandDiscountChart({ data = [] }) {
  const groups = {
    "0%": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },

    "1~10%": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },

    "11~20%": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },

    "21~30%": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },

    "31~40%": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },

    "41% 이상": {
      trueDemand: 0,
      salesQty: 0,
      count: 0,
    },
  };


  data.forEach((item) => {
    const group = getDiscountGroup(item.discount_pct);

    const trueDemand = Number(item.true_demand) || 0;
    const salesQty = Number(item.sales_qty) || 0;

    groups[group].trueDemand += trueDemand;
    groups[group].salesQty += salesQty;
    groups[group].count += 1;
  });


  const chartData = Object.entries(groups)
    .filter(([, value]) => value.count > 0)
    .map(([name, value]) => ({
      name,

      trueDemand: Number(
        (value.trueDemand / value.count).toFixed(1)
      ),

      salesQty: Number(
        (value.salesQty / value.count).toFixed(1)
      ),
    }));


  return (
    <section className="demand-discount-chart">

      {/* 헤더 */}
      <div className="demand-discount-chart__header">
        <div>
          <h3 className="demand-discount-chart__title">
            할인율에 따른 수요
          </h3>

          <p className="demand-discount-chart__desc">
            할인율 구간별 평균 실제 수요와 판매량을 비교합니다.
          </p>
        </div>

        <span className="demand-discount-chart__scenario">
          할인율 기준
        </span>
      </div>


      {/* 차트 */}
      <div className="demand-discount-chart__body">

        {chartData.length === 0 ? (
          <div className="empty">
            할인율 데이터가 없습니다.
          </div>
        ) : (
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

            </BarChart>
          </ResponsiveContainer>
        )}

      </div>


      {/* 하단 설명 */}
      <div className="demand-discount-chart__footer">
        할인율이 높아질수록 실제 수요와 판매량이 어떻게
        변화하는지 비교할 수 있습니다.
      </div>

    </section>
  );
}