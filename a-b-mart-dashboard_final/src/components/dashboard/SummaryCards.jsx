import Card from "../common/Card";
import { getSummary } from "../../utils/dashboard";
import "./styles/SummaryCards.css";

const fmt = (n) => Math.round(n).toLocaleString();

export default function SummaryCards({ data }) {
  const summary = getSummary(data);

  return (
    <section className="summary-grid">
      <Card title="예측 수요" value={fmt(summary.predictedDemand)} unit="개" description="선택 범위 기준" />
      <Card title="긴급 발주 필요" value={fmt(summary.urgentOrders)} unit="건" description="재주문점 이하" />
      <Card title="권장 발주량" value={fmt(summary.recommendedOrderQty)} unit="개" description="안전재고 90% 기준" />
      <Card title="적정 재고 비율" value={summary.adequateRate.toFixed(1)} unit="%" description="현재 재고 기준" />
    </section>
  );
}