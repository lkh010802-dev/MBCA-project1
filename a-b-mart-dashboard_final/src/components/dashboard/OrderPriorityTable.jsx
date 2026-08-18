import { getOrderPriority } from "../../utils/dashboard";
import { getProductName, getCategoryName } from "../../utils/formatters"; // getCategoryName 함께 임포트
import Badge from "../common/Badge";
import "./styles/OrderPriorityTable.css";

export default function OrderPriorityTable({ data }) {
  const rows = getOrderPriority(data);

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>발주 우선순위 TOP 5</h2>
          <p>권장 발주량이 큰 상품부터 표시합니다.</p>
        </div>
      </div>
      <div className="order-priority-table-wrap">
        <table className="order-priority-table">
          <thead>
            <tr>
              <th>순위</th>
              <th>상품</th>
              <th>카테고리</th>
              <th>예측수요</th>
              <th>권장발주</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.product_id}>
                <td className="rank">{i + 1}</td>
                {/* 상품명 한글 출력 */}
                <td>{getProductName(row.product_id)}</td>
                {/* 카테고리 한글 출력 */}
                <td>{getCategoryName(row.category)}</td>
                <td>{Math.round(row.predicted_demand).toLocaleString()}</td>
                <td className="strong">{Math.round(row.order_qty_90).toLocaleString()}</td>
                <td>
                  {row.reorder_count > 0
                    ? <Badge type="danger">발주 필요</Badge>
                    : <Badge>정상</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}