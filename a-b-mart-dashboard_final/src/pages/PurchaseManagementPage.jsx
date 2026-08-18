import { useMemo, useState } from "react";

import {
  getProductName,
  getStoreName,
  getCategoryName,
} from "../utils/formatters";

import "./styles/PurchaseManagementPage.css";

// ==========================================
// 원화 포맷
// ==========================================

const formatKRW = (amount) =>
  `₩${Math.round(Number(amount) || 0).toLocaleString("ko-KR")}`;

export default function PurchaseManagement({
  data = [],
  martType = "A마트",
}) {
  const [storeFilter, setStoreFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [serviceLevel, setServiceLevel] = useState("90");

  const [selected, setSelected] = useState([]);
  const [approved, setApproved] = useState([]);
  const [orderQty, setOrderQty] = useState({});
  // ==========================================
  // 데이터 가공
  // ==========================================

  const purchaseData = useMemo(() => {
    return data
      .map((item, index) => {
        const stock =
          Number(item.stock_level_start) || 0;

        const recommendedStock =
          Number(
            serviceLevel === "95"
              ? item.recommended_stock_95
              : item.recommended_stock_90
          ) || 0;

        const reorderPoint =
          Number(
            serviceLevel === "95"
              ? item.reorder_point_95
              : item.reorder_point_90
          ) || 0;

        const originalOrderQty =
          Number(
            serviceLevel === "95"
              ? item.order_qty_95
              : item.order_qty_90
          ) ||
          Math.max(
            Math.ceil(
              recommendedStock - stock
            ),
            0
          );

        const id =
          `${item.store_id}_${item.product_id}_${index}`;

        return {
          ...item,

          id,

          // ==========================================
          // formatter.js 사용
          // ==========================================

          storeId: item.store_id,

          storeName: getStoreName(
            item.store_id
          ),

          productName: getProductName(
            item.product_id
          ),

          categoryName: getCategoryName(
            item.category
          ),

          // ==========================================
          // 수요 / 재고 데이터
          // ==========================================

          stock,

          predictedDemand:
            Number(
              item.predicted_demand
            ) || 0,

          leadTime:
            Number(
              item.lead_time_days_adj
            ) ||
            Number(
              item.lead_time_days
            ) ||
            0,

          leadTimeDemand:
            Number(
              item.lead_time_demand
            ) || 0,

          safetyStock:
            Number(
              serviceLevel === "95"
                ? item.safety_stock_95
                : item.safety_stock_90
            ) || 0,

          recommendedStock,

          reorderPoint,

          originalOrderQty,

          actualPrice:
            Number(
              item.actual_price
            ) || 0,
        };
      })

      // 발주량이 있는 상품만 검토 대상
      .filter(
        (item) =>
          item.originalOrderQty > 0
      );
  }, [data, serviceLevel]);

  // ==========================================
  // 필터
  // ==========================================

  const filteredData = useMemo(() => {
    return purchaseData.filter((item) => {
      // 매장 필터
      const storeMatch =
        storeFilter === "ALL" ||
        item.storeId === storeFilter;

      // 위험도
      const status =
        item.stock <= item.reorderPoint
          ? "URGENT"
          : "NORMAL";

      const statusMatch =
        statusFilter === "ALL" ||
        status === statusFilter;

      // 검색
      const searchText =
        search.trim().toLowerCase();

      const searchMatch =
        !searchText ||
        String(
          item.productName
        )
          .toLowerCase()
          .includes(searchText) ||
        String(
          item.product_id
        )
          .toLowerCase()
          .includes(searchText) ||
        String(
          item.categoryName
        )
          .toLowerCase()
          .includes(searchText);

      return (
        storeMatch &&
        statusMatch &&
        searchMatch
      );
    });
  }, [
    purchaseData,
    storeFilter,
    statusFilter,
    search,
  ]);

  // ==========================================
  // 현재 발주량
  // ==========================================

  const getOrderQty = (item) => {
    if (
      orderQty[item.id] !== undefined
    ) {
      return orderQty[item.id];
    }

    return Math.ceil(
      item.originalOrderQty
    );
  };

  // ==========================================
  // 체크
  // ==========================================

  const toggleSelected = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter(
            (item) => item !== id
          )
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    const ids =
      filteredData.map(
        (item) => item.id
      );

    const allSelected =
      ids.length > 0 &&
      ids.every((id) =>
        selected.includes(id)
      );

    if (allSelected) {
      setSelected((prev) =>
        prev.filter(
          (id) => !ids.includes(id)
        )
      );
    } else {
      setSelected((prev) => [
        ...new Set([
          ...prev,
          ...ids,
        ]),
      ]);
    }
  };

  // ==========================================
  // 발주량 조정
  // ==========================================

  const changeOrderQty = (
    item,
    amount
  ) => {
    const current =
      getOrderQty(item);

    setOrderQty((prev) => ({
      ...prev,

      [item.id]: Math.max(
        0,
        current + amount
      ),
    }));
  };

  // ==========================================
  // 보류
  // ==========================================

  const handleHold = (item) => {
    setSelected((prev) =>
      prev.filter(
        (id) => id !== item.id
      )
    );
  };

  // ==========================================
  // 승인
  // ==========================================

  const handleApprove = (item) => {
    setApproved((prev) =>
      prev.includes(item.id)
        ? prev
        : [...prev, item.id]
    );

    setSelected((prev) =>
      prev.filter(
        (id) => id !== item.id
      )
    );
  };

  // ==========================================
  // 선택된 발주안
  // ==========================================

  const selectedItems =
    purchaseData.filter(
      (item) =>
        selected.includes(item.id)
    );

  const approvedItems =
    purchaseData.filter(
      (item) =>
        approved.includes(item.id)
    );

  // ==========================================
  // 통계
  // ==========================================

  const totalRecommendedQty =
    filteredData.reduce(
      (sum, item) =>
        sum + getOrderQty(item),
      0
    );

  const selectedQty =
    selectedItems.reduce(
      (sum, item) =>
        sum + getOrderQty(item),
      0
    );

  const selectedAmount =
    selectedItems.reduce(
      (sum, item) =>
        sum +
        getOrderQty(item) *
          item.actualPrice,
      0
    );

  const approvedQty =
    approvedItems.reduce(
      (sum, item) =>
        sum + getOrderQty(item),
      0
    );

  const approvedAmount =
    approvedItems.reduce(
      (sum, item) =>
        sum +
        getOrderQty(item) *
          item.actualPrice,
      0
    );

  const totalExpectedAmount =
    filteredData.reduce(
      (sum, item) =>
        sum +
        getOrderQty(item) *
          item.actualPrice,
      0
    );

  const urgentCount =
    filteredData.filter(
      (item) =>
        item.stock <=
        item.reorderPoint
    ).length;

  // ==========================================
  // 매장 목록
  // ==========================================

  const storeList = [
    ...new Set(
      purchaseData.map(
        (item) => item.storeId
      )
    ),
  ];

  // ==========================================
  // CSV
  // ==========================================

  const exportCSV = () => {
    const target =
      approvedItems.length > 0
        ? approvedItems
        : selectedItems;

    if (target.length === 0) {
      alert(
        "내보낼 발주 항목을 선택해주세요."
      );
      return;
    }

    const headers = [
      "상품ID",
      "상품명",
      "카테고리",
      "매장",
      "현재재고",
      "예측수요",
      "리드타임",
      "안전재고",
      "권장재고",
      "발주량",
      "단가",
      "예상금액",
    ];

    const rows = target.map(
      (item) => [
        item.product_id,
        item.productName,
        item.categoryName,
        item.storeName,
        item.stock,
        item.predictedDemand.toFixed(
          1
        ),
        item.leadTime,
        item.safetyStock.toFixed(
          1
        ),
        item.recommendedStock.toFixed(
          1
        ),
        getOrderQty(item),
        item.actualPrice.toFixed(
          2
        ),
        (
          getOrderQty(item) *
          item.actualPrice
        ).toFixed(2),
      ]
    );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${value}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "발주관리_발주안.csv";

    link.click();

    URL.revokeObjectURL(url);
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="purchase-page">

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="purchase-header">

        <div>

          <div className="purchase-brand">
            SmartOrder · {martType}
          </div>

          <h1>발주 관리</h1>

          <p>
            모델 권장량을 검토하고
            담당자 판단·박스 단위·MOQ를
            반영해 발주안을 확정합니다.
          </p>

        </div>

        <div className="purchase-header-right">

          <button
            className="header-action"
            onClick={exportCSV}
          >
            검토 · 승인 · 내보내기
          </button>

          <span>
            서비스 수준{" "}
            {serviceLevel}%
          </span>

        </div>

      </header>


      {/* ======================================
          KPI
      ====================================== */}

      <section className="purchase-kpi-grid">

        <div className="purchase-kpi purple">

          <span>검토 대상</span>

          <strong>
            {filteredData.length}
            <small>개</small>
          </strong>

          <p>
            발주 검토가 필요한 상품
          </p>

        </div>


        <div className="purchase-kpi blue">

          <span>
            권장 발주 총량
          </span>

          <strong>
            {totalRecommendedQty.toLocaleString()}
            <small>개</small>
          </strong>

          <p>
            조정 수량 실시간 반영
          </p>

        </div>


        <div className="purchase-kpi green">

          <span>승인 완료</span>

          <strong>
            {approvedItems.length}
            <small>개</small>
          </strong>

          <p>
            승인 수량{" "}
            {approvedQty.toLocaleString()}
            개
          </p>

        </div>


        <div className="purchase-kpi orange">

          <span>총 예상 금액</span>

          <strong>
            {formatKRW(
              totalExpectedAmount
            )}
          </strong>

          <p>
            서비스 수준{" "}
            {serviceLevel}%
          </p>

        </div>

      </section>


      {/* ======================================
          STEP
      ====================================== */}

      <section className="purchase-steps">

        <div className="step done">

          <b>1</b>

          <div>
            <strong>
              모델 추천
            </strong>

            <span>
              재고·수요 기반 산출
            </span>
          </div>

        </div>


        <div className="step active">

          <b>2</b>

          <div>
            <strong>
              담당자 검토
            </strong>

            <span>
              수량·우선순위 조정
            </span>
          </div>

        </div>


        <div className="step">

          <b>3</b>

          <div>
            <strong>
              발주안 승인
            </strong>

            <span>
              승인 및 발주 결정
            </span>
          </div>

        </div>


        <div className="step">

          <b>4</b>

          <div>
            <strong>
              CSV 내보내기
            </strong>

            <span>
              구매 시스템 전달
            </span>
          </div>

        </div>

      </section>


      {/* ======================================
          FILTER
      ====================================== */}

      <section className="purchase-filter">

        {/* 매장 */}

        <div className="filter-item">

          <label>매장</label>

          <select
            value={storeFilter}
            onChange={(e) =>
              setStoreFilter(
                e.target.value
              )
            }
          >

            <option value="ALL">
              전체 매장
            </option>

            {storeList.map(
              (store) => (
                <option
                  key={store}
                  value={store}
                >
                  {getStoreName(
                    store
                  )}
                </option>
              )
            )}

          </select>

        </div>


        {/* 상태 */}

        <div className="filter-item">

          <label>
            검토 상태
          </label>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value
              )
            }
          >

            <option value="ALL">
              전체 상태
            </option>

            <option value="URGENT">
              긴급
            </option>

            <option value="NORMAL">
              일반
            </option>

          </select>

        </div>


        {/* 서비스 수준 */}

        <div className="filter-item">

          <label>
            서비스 수준
          </label>

          <select
            value={serviceLevel}
            onChange={(e) =>
              setServiceLevel(
                e.target.value
              )
            }
          >

            <option value="90">
              90%
            </option>

            <option value="95">
              95%
            </option>

          </select>

        </div>


        {/* 검색 */}

        <div className="filter-search">

          <label>
            상품 검색
          </label>

          <input
            type="text"
            placeholder="상품명 또는 상품 ID"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
          />

        </div>

      </section>


      {/* ======================================
          CONTENT
      ====================================== */}

      <section className="purchase-content">

        {/* ====================================
            TABLE
        ==================================== */}

        <div className="purchase-list">

          <div className="purchase-list-header">

            <div>

              <h2>
                발주 검토 목록
              </h2>

              <p>
                수요 분석 및 안전재고
                기준을 적용합니다.
              </p>

            </div>

            <span>
              {filteredData.length}
              개 상품
            </span>

          </div>


          <div className="purchase-table-wrap">

            <table>

              <thead>

                <tr>

                  <th>

                    <input
                      type="checkbox"
                      checked={
                        filteredData.length >
                          0 &&
                        filteredData.every(
                          (item) =>
                            selected.includes(
                              item.id
                            )
                        )
                      }
                      onChange={
                        toggleAll
                      }
                    />

                  </th>

                  <th>상품</th>

                  <th>매장</th>

                  <th>위험</th>

                  <th>현재재고</th>

                  <th>권장재고</th>

                  <th>발주량</th>

                  <th>예상 금액</th>

                  <th>판정</th>

                </tr>

              </thead>


              <tbody>

                {filteredData.map(
                  (item) => {

                    const urgent =
                      item.stock <=
                      item.reorderPoint;

                    const qty =
                      getOrderQty(item);

                    const amount =
                      qty *
                      item.actualPrice;

                    const isApproved =
                      approved.includes(
                        item.id
                      );

                    return (

                      <tr
                        key={item.id}
                        className={
                          isApproved
                            ? "approved-row"
                            : ""
                        }
                      >

                        {/* 선택 */}

                        <td>

                          <input
                            type="checkbox"
                            checked={selected.includes(
                              item.id
                            )}
                            onChange={() =>
                              toggleSelected(
                                item.id
                              )
                            }
                          />

                        </td>


                        {/* 상품 */}

                        <td>

                          <div className="product-cell">

                            <strong>
                              {item.productName}
                            </strong>

                            <span>
                              {item.categoryName}
                              {" · "}
                              {item.product_id}
                            </span>

                          </div>

                        </td>


                        {/* 매장 */}

                        <td>

                          <div className="store-cell">

                            {item.storeName}

                            <span>
                              {item.storeId}
                            </span>

                          </div>

                        </td>


                        {/* 위험 */}

                        <td>

                          <span
                            className={
                              urgent
                                ? "risk urgent"
                                : "risk normal"
                            }
                          >

                            {urgent
                              ? "긴급"
                              : "일반"}

                          </span>

                        </td>


                        {/* 현재 재고 */}

                        <td>

                          {Math.round(
                            item.stock
                          ).toLocaleString()}

                        </td>


                        {/* 권장 재고 */}

                        <td>

                          {Math.ceil(
                            item.recommendedStock
                          ).toLocaleString()}

                        </td>


                        {/* 발주량 */}

                        <td>

                          <div className="qty-control">

                            <button
                              onClick={() =>
                                changeOrderQty(
                                  item,
                                  -1
                                )
                              }
                            >
                              −
                            </button>

                            <strong>
                              {qty.toLocaleString()}
                            </strong>

                            <button
                              onClick={() =>
                                changeOrderQty(
                                  item,
                                  1
                                )
                              }
                            >
                              +
                            </button>

                          </div>

                        </td>


                        {/* 예상 금액 */}

                        <td>
                          {formatKRW(amount)}
                        </td>


                        {/* 판정 */}

                        <td>

                          <div className="row-actions">

                            <button
                              onClick={() =>
                                handleHold(
                                  item
                                )
                              }
                            >
                              보류
                            </button>

                            <button
                              className="approve"
                              onClick={() =>
                                handleApprove(
                                  item
                                )
                              }
                            >
                              {isApproved
                                ? "승인됨"
                                : "승인"}
                            </button>

                          </div>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        </div>


        {/* ====================================
            SUMMARY
        ==================================== */}

        <aside className="purchase-summary">

          <h2>
            발주안 요약
          </h2>

          <p>
            선택한 상품의 발주안을
            요약합니다.
          </p>


          <div className="summary-row">

            <span>
              선택 SKU
            </span>

            <strong>
              {selectedItems.length}
              개
            </strong>

          </div>


          <div className="summary-row">

            <span>
              선택 수량
            </span>

            <strong>
              {selectedQty.toLocaleString()}
              개
            </strong>

          </div>


          <div className="summary-row">

            <span>
              선택 금액
            </span>

            <strong>
              {formatKRW(selectedAmount)}
            </strong>

          </div>


          <div className="summary-policy">

            <strong>
              발주 정책
            </strong>

            <p>
              서비스 수준:{" "}
              {serviceLevel}%
              <br />

              안전재고 기준:{" "}
              {serviceLevel === "95"
                ? "95%"
                : "90%"}
              <br />

              재주문점 이하 상품
              우선 검토
              <br />

              현재 재고 대비
              권장재고 차이 반영
            </p>

          </div>


          <div className="summary-stat">

            <span>
              긴급 발주
            </span>

            <strong>
              {urgentCount}개
            </strong>

          </div>


          <button
            className="summary-button outline"
            onClick={() => {

              if (
                selectedItems.length ===
                0
              ) {
                alert(
                  "승인할 상품을 선택해주세요."
                );

                return;
              }

              selectedItems.forEach(
                (item) =>
                  handleApprove(item)
              );

            }}
          >
            선택 발주 승인
          </button>


          <button
            className="summary-button primary"
            onClick={exportCSV}
          >
            승인 발주안 CSV 내보내기
          </button>

        </aside>

      </section>

    </div>
  );
}

