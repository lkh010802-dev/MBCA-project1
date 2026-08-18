import StoreSelector from "./StoreSelector";
import "./styles/DashboardHeader.css";

export default function DashboardHeader({
  stores,
  value,
  onChange,
  martType = "A마트",
}) {
  const isBmart = martType === "B마트";

  const martName = isBmart ? "B마트" : "A마트";
  const aiTitle = isBmart
    ? "B-MART INVENTORY AI"
    : "A-MART INVENTORY AI";

  return (
    <header className="dashboard-header">
      <div>
        <div className="eyebrow">
          {aiTitle}
        </div>

        <h1>
          {martName} 재고·발주 대시보드
        </h1>

        <p>
          수요예측 기반 재고 및 발주 의사결정 지원
        </p>
      </div>

      <StoreSelector
        stores={stores}
        value={value}
        onChange={onChange}
      />
    </header>
  );
}