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

import "./styles/DemandCategoryChart.css";

export default function DemandCategoryChart({ data = [] }) {
  const categoryData = {};

  // 카테고리 표시명
  const categoryNameMap = {
    Apparel: "의류",
    Electronics: "가전",
    Grocery: "식료품",
    Home: "홈/리빙",
  };

  // 카테고리별 데이터 집계
  data.forEach((item) => {
    const category = item.category;

    if (!category) {
      return;
    }

    if (!categoryData[category]) {
      categoryData[category] = {
        trueDemand: 0,
        salesQty: 0,
        count: 0,
      };
    }

    categoryData[category].trueDemand +=
      Number(item.true_demand) || 0;

    categoryData[category].salesQty +=
      Number(item.sales_qty) || 0;

    categoryData[category].count += 1;
  });

  // 평균값 계산
  const chartData = Object.entries(categoryData)
    .map(([category, value]) => ({
      // 원본 카테고리
      category,

      // 화면에 표시할 카테고리명
      categoryName:
        categoryNameMap[category] || category,

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
    }))
    .sort((a, b) => b.trueDemand - a.trueDemand);

  return (
    <section className="demand-category-chart">

      {/* 헤더 */}
      <div className="demand-category-chart__header">
        <div>
          <h3 className="demand-category-chart__title">
            카테고리별 수요 특성
          </h3>

          <p className="demand-category-chart__desc">
            상품 카테고리별 평균 실제 수요와 판매량을 비교합니다.
          </p>
        </div>

        <span className="demand-category-chart__scenario">
          카테고리별 평균
        </span>
      </div>


      {/* 차트 */}
      <div className="demand-category-chart__body">

        {chartData.length === 0 ? (
          <div className="empty">
            카테고리별 수요 데이터가 없습니다.
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
                dataKey="categoryName"
                width={70}
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
                fill="#7c3aed"
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


      {/* 하단 설명 */}
      <div className="demand-category-chart__footer">
        카테고리별 수요 차이를 비교하여 수요가 높은 상품군과
        상대적으로 낮은 상품군을 확인할 수 있습니다.
      </div>

    </section>
  );
}