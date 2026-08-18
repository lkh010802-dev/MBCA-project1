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
import { getProductName } from "../../utils/formatters"; // 유틸리티 함수 임포트
import "./styles/ProductOrderChart.css";

export default function ProductOrderChart({ data }) {
  const rawChartData = getProductChartData(data);

  // 데이터 안의 product_id를 한글 이름으로 변환해서 새 배열 생성
  const chartData = rawChartData.map((item) => ({
    ...item,
    product_id: getProductName(item.product_id), // 한글 이름으로 교체
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
              top: 10,
              right: 20,
              left: 10,
              bottom: 50,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="product_id"
              interval={0}
              angle={-25}
              textAnchor="end"
              height={70}
              tick={{ fontSize: 11 }}
            />

            <YAxis
              tick={{ fontSize: 11 }}
            />

            <Tooltip
              formatter={(value) =>
                `${Number(value).toLocaleString()}개`
              }
            />

            <Legend />

            {/* 예측수요 - 파란색 */}
            <Bar
              dataKey="predicted_demand"
              name="예측수요"
              fill="#3B82F6"
              radius={[3, 3, 0, 0]}
            />

            {/* 리드타임 수요 - 주황색 */}
            <Bar
              dataKey="lead_time_demand"
              name="리드타임 수요"
              fill="#F59E0B"
              radius={[3, 3, 0, 0]}
            />

            {/* 권장발주량 - 보라색 */}
            <Bar
              dataKey="order_qty_90"
              name="권장발주량"
              fill="#8B5CF6"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}