import Badge from "../common/Badge";
import { getRiskRows } from "../../utils/dashboard";
import { getProductName, getStoreName } from "../../utils/formatters"; // 유틸리티 함수 임포트
import "./styles/StockRisk.css";

export default function StockRisk({ data }) {
  const rows = getRiskRows(data, 5);

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>품절 위험</h2>
          <p>재주문점 이하 재고를 우선 표시합니다.</p>
        </div>
        <Badge type={rows.length ? "danger" : "success"}>
          {rows.length ? `${rows.length}건 위험` : "위험 없음"}
        </Badge>
      </div>
      <div className="risk-list">
        {rows.length === 0 && <div className="empty">품절 위험 상품이 없습니다.</div>}
        {rows.map((row) => (
          <div className="risk-row" key={`${row.date}-${row.store_id}-${row.product_id}`}>
            <div>
              {/* 유틸리티 함수로 상품명을 한글로 출력 */}
              <strong>{getProductName(row.product_id)}</strong>
              {/* 유틸리티 함수로 매장명을 '매장 X'로 출력 */}
              <span>{getStoreName(row.store_id)} · {row.date}</span>
            </div>
            <div className="risk-values">
              <span>현재 {Math.round(row.stock_level_start).toLocaleString()}</span>
              <span>재주문점 {Math.round(row.reorder_point_90).toLocaleString()}</span>
              <Badge type="danger">긴급</Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}