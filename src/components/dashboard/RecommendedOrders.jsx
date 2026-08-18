import { useState } from "react";
import { getRecommendedOrders } from "../../utils/dashboard";
import { getProductName, getStoreName } from "../../utils/formatters"; // 유틸리티 함수 임포트
import Badge from "../common/Badge";
import "./styles/RecommendedOrders.css";

export default function RecommendedOrders({ data }) {
  const allRows = getRecommendedOrders(data);
  const rows = allRows.slice(0, 5);
  const [adjustments, setAdjustments] = useState({});

  const setAdjustment = (key, value) => {
    setAdjustments((prev) => ({
      ...prev,
      [key]: Math.max(0, Number(value) || 0),
    }));
  };

  return (
    <section className="panel full-width">
      <div className="panel-title">
        <div>
          <h2>권장 발주안 확인 및 조정</h2>
          <p>
            안전재고 90% 기준 권장 발주량입니다. 최종 발주량은 임시 조정값으로 계산됩니다.
          </p>
        </div>

        {allRows.length > 5 && (
          <span className="panel-count">상위 5건 표시</span>
        )}
      </div>

      <div className="recommended-list">
        {rows.length === 0 ? (
          <div className="empty">권장 발주 데이터가 없습니다.</div>
        ) : (
          rows.map((row) => {
            const key = `${row.date}-${row.store_id}-${row.product_id}`;
            const adjusted = adjustments[key];
            const recommendedQty = Math.ceil(row.order_qty_90);
            const finalQty = adjusted ?? recommendedQty;

            return (
              <div className="recommended-row" key={key}>
                <div className="recommended-info">
                  {/* 유틸리티 함수로 상품명을 한글로 출력 */}
                  <div className="recommended-product">
                    {getProductName(row.product_id)}
                  </div>
                  <div className="recommended-meta">
                    <span>{row.date}</span>
                    {/* 유틸리티 함수로 매장 코드를 '매장 X'로 출력 */}
                    <span>{getStoreName(row.store_id)}</span>
                  </div>
                </div>

                <div className="recommended-item">
                  <span className="recommended-label">예측수요</span>
                  <strong>{Math.round(row.predicted_demand).toLocaleString()}</strong>
                </div>

                <div className="recommended-item">
                  <span className="recommended-label">리드타임</span>
                  <strong>{row.lead_time_days}일</strong>
                </div>

                <div className="recommended-item">
                  <span className="recommended-label">안전재고</span>
                  <strong>{Math.round(row.safety_stock_90).toLocaleString()}</strong>
                </div>

                <div className="recommended-item">
                  <span className="recommended-label">권장발주</span>
                  <strong className="recommended-qty">
                    {recommendedQty.toLocaleString()}
                  </strong>
                </div>

                <div className="recommended-adjust">
                  <span className="recommended-label">조정</span>
                  <input
                    className="qty-input"
                    type="number"
                    min="0"
                    value={adjusted ?? recommendedQty}
                    onChange={(e) => setAdjustment(key, e.target.value)}
                  />
                </div>

                <div className="recommended-final">
                  <span className="recommended-label">최종발주</span>
                  <Badge type="success">
                    {Math.round(finalQty).toLocaleString()}개
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}