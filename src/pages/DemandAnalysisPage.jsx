import DemandPromoChart from "../components/demand/DemandPromoChart";
import DemandDiscountChart from "../components/demand/DemandDiscountChart";
import DemandSeasonChart from "../components/demand/DemandSeasonChart";
import DemandStoreChart from "../components/demand/DemandStoreChart";
import DemandDefectChart from "../components/demand/DemandDefectChart";
import DemandCategoryChart from "../components/demand/DemandCategoryChart";

import "./styles/DemandAnalysisPage.css";

export default function DemandAnalysisPage({
  data = [],
  martType = "A마트",
}) {
  return (
    <div className="demand-analysis-page">

      {/* 페이지 헤더 */}
      <div className="demand-analysis-header">
       <div>
        <span className="breadcrumb">
          SmartOrder · {martType}
        </span>

        <h1>수요 분석</h1>

        <p>
         프로모션, 할인, 계절성, 매장, 결품 및
         카테고리별 수요 특성을 분석합니다.
        </p>
      </div>
    </div>

      {/* 수요 분석 컴포넌트 */}
      <div className="demand-analysis-grid">

        <DemandPromoChart
          data={data}
        />

        <DemandDiscountChart
          data={data}
        />

        <DemandSeasonChart
          data={data}
        />

        <DemandStoreChart
          data={data}
        />

        <DemandDefectChart
          data={data}
        />

        <DemandCategoryChart
          data={data}
        />

      </div>

    </div>
  );
}