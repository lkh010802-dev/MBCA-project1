import { useMemo, useState } from "react";

import DashboardHeader from "../components/dashboard/DashboardHeader";
import SummaryCards from "../components/dashboard/SummaryCards";
import OrderPriorityTable from "../components/dashboard/OrderPriorityTable";
import ProductOrderChart from "../components/dashboard/ProductOrderChart";
import StockRisk from "../components/dashboard/StockRisk";
import InventoryStatus from "../components/dashboard/InventoryStatus";
import RecommendedOrders from "../components/dashboard/RecommendedOrders";

import "./styles/Dashboard.css";

export default function Dashboard({ data, martType }) {
  const [storeId, setStoreId] = useState("ALL");

  const stores = useMemo(
    () => [...new Set(data.map((row) => row.store_id))].sort(),
    [data]
  );

  const filteredData = useMemo(() => {
    if (storeId === "ALL") return data;
    return data.filter((row) => row.store_id === storeId);
  }, [data, storeId]);

  return (
    <main className="app-shell">

      {/* 대시보드 상단 */}
      <DashboardHeader
        martType={martType}
        stores={stores}
        value={storeId}
        onChange={setStoreId}
      />

      <div className="content">

        {/* ==============================
            상단 요약 카드 4개
           ============================== */}
        <SummaryCards data={filteredData} />


        {/* ==============================
            중간 영역
            ① 발주 우선순위 TOP 5
            ② 상품별 발주 필요 근거
            ③ 품절 위험
           ============================== */}
        <div className="dashboard-middle">

          <OrderPriorityTable
            data={filteredData}
          />

          <ProductOrderChart
            data={filteredData}
          />

          <StockRisk
            data={filteredData}
          />

        </div>


        {/* ==============================
            하단 영역
            왼쪽 : 권장 발주안
            오른쪽 : 재고 현황
           ============================== */}
        <div className="dashboard-bottom">

          <RecommendedOrders
            data={filteredData}
          />

          <InventoryStatus
            data={filteredData}
          />

        </div>

      </div>

      <footer className="footer">
        {martType} AI 재고·발주 대시보드 ·{" "}
        {filteredData.length.toLocaleString()} rows
      </footer>

    </main>
  );
}