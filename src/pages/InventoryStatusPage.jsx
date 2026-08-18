import React, { useEffect, useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import {
  getProductName,
  getStoreName,
  getCategoryName,
} from "../utils/formatters";

import "./styles/InventoryStatusPage.css";


/* =========================================================
   숫자 변환
   CSV 데이터가 문자열이어도 안전하게 계산
   ========================================================= */
const toNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(String(value).replace(/,/g, ""));

  return Number.isFinite(number) ? number : fallback;
};


/* =========================================================
   날짜 비교
   YYYY-MM-DD 형식이므로 문자열 비교 가능
   ========================================================= */
const normalizeDate = (value) => {
  if (!value) return "";

  return String(value).trim();
};


export default function InventoryStatusPage({
  data = [],
  martType = "A마트",
}) {
  /* =======================================================
     원본 데이터
     ======================================================= */
  const rows = Array.isArray(data) ? data : [];


  /* =======================================================
     1. 사용 가능한 기준일
     ======================================================= */
  const availableDates = useMemo(() => {
    return [...new Set(
      rows
        .map((row) => normalizeDate(row.date))
        .filter(Boolean)
    )].sort();
  }, [rows]);


  /* =======================================================
     최신 기준일
     ======================================================= */
  const latestDate = useMemo(() => {
    if (availableDates.length === 0) {
      return "";
    }

    return availableDates[availableDates.length - 1];
  }, [availableDates]);


  /* =======================================================
     상태
     ======================================================= */
  const [selectedDate, setSelectedDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;


  /* =======================================================
     중요 수정
     
     A마트 → B마트처럼 data가 변경되면
     기존 selectedDate를 그대로 사용하지 않는다.
     
     예:
     A마트 = 2025-12-31
     B마트 = 2024-01-30
     
     B마트로 전환했는데 2025-12-31을 계속 들고 있으면
     snapshotRows가 0건이 된다.
     ======================================================= */
  useEffect(() => {
    if (availableDates.length === 0) {
      setSelectedDate("");
      return;
    }

    setSelectedDate((previousDate) => {
      if (availableDates.includes(previousDate)) {
        return previousDate;
      }

      return latestDate;
    });

    setCurrentPage(1);
  }, [availableDates, latestDate]);


  /* =======================================================
     매장 목록
     ======================================================= */
  const storeIds = useMemo(() => {
    return [
      ...new Set(
        rows
          .map((row) => row.store_id)
          .filter(
            (value) =>
              value !== null &&
              value !== undefined &&
              value !== ""
          )
      ),
    ];
  }, [rows]);


  /* =======================================================
     선택 기준일 스냅샷
     ======================================================= */
  const snapshotRows = useMemo(() => {
    if (!selectedDate) {
      return [];
    }

    return rows.filter(
      (row) => normalizeDate(row.date) === selectedDate
    );
  }, [rows, selectedDate]);


  /* =======================================================
     카테고리 목록
     
     A마트:
       Electronics
       Grocery
       Apparel
       Home
     
     B마트:
       Electronics
       Clothing
       Groceries
       Toys
       Furniture
     
     데이터에 실제 존재하는 카테고리를 자동으로 생성
     ======================================================= */
  const categoryOptions = useMemo(() => {
    return [
      ...new Set(
        snapshotRows
          .map((row) => row.category)
          .filter(Boolean)
      ),
    ].sort();
  }, [snapshotRows]);


  /* =======================================================
     2. 상품별 재고 상태 계산
     
     상태 우선순위:

     1순위 = 발주 필요
     2순위 = 과잉 재고
     3순위 = 적정 재고

     이렇게 해야 한 상품이
     부족 + 과잉으로 동시에 계산되지 않는다.
     ======================================================= */
  const getInventoryStatus = (row) => {
    const currentStock = toNumber(row.stock_level_start);
    const recommendedStock = toNumber(
      row.recommended_stock_90
    );

    const reorderPoint = toNumber(
      row.reorder_point_90
    );

    const reorderFlag = toNumber(
      row.reorder_flag_90
    );

    /* -----------------------------------------------
       발주 필요
       
       데이터셋에서 제공하는 reorder_flag_90을
       가장 신뢰하는 기준으로 사용.
       
       혹시 flag가 없더라도
       현재재고 <= 재주문점이면 부족 처리.
       ----------------------------------------------- */
    const isShortage =
      reorderFlag === 1 ||
      currentStock <= reorderPoint;


    /* -----------------------------------------------
       과잉 재고
       
       단, 이미 발주 필요로 판정된 상품은
       과잉으로 중복 판정하지 않는다.
       ----------------------------------------------- */
    const isExcess =
      !isShortage &&
      currentStock > recommendedStock;


    /* -----------------------------------------------
       적정 재고
       ----------------------------------------------- */
    const isOptimal =
      !isShortage &&
      !isExcess;


    if (isShortage) {
      return "shortage";
    }

    if (isExcess) {
      return "excess";
    }

    return "optimal";
  };


  /* =======================================================
     상태가 계산된 스냅샷
     ======================================================= */
  const classifiedRows = useMemo(() => {
    return snapshotRows.map((row) => ({
      ...row,
      inventoryStatus: getInventoryStatus(row),
    }));
  }, [snapshotRows]);


  /* =======================================================
     3. 상단 요약 지표
     
     반드시 서로 겹치지 않는 상태값을 사용
     ======================================================= */
  const shortageRows = useMemo(() => {
    return classifiedRows.filter(
      (row) => row.inventoryStatus === "shortage"
    );
  }, [classifiedRows]);


  const excessRows = useMemo(() => {
    return classifiedRows.filter(
      (row) => row.inventoryStatus === "excess"
    );
  }, [classifiedRows]);


  const optimalRows = useMemo(() => {
    return classifiedRows.filter(
      (row) => row.inventoryStatus === "optimal"
    );
  }, [classifiedRows]);


  /* =======================================================
     적정 비율
     ======================================================= */
  const optimalRatio = useMemo(() => {
    if (classifiedRows.length === 0) {
      return "0.0";
    }

    return (
      (optimalRows.length / classifiedRows.length) *
      100
    ).toFixed(1);
  }, [classifiedRows, optimalRows]);


  /* =======================================================
     4. 메인 테이블 필터
     ======================================================= */
  const filteredRows = useMemo(() => {
    return classifiedRows.filter((row) => {

      /* 상태 */
      if (
        filterType !== "all" &&
        row.inventoryStatus !== filterType
      ) {
        return false;
      }


      /* 매장 */
      if (
        selectedStore !== "all" &&
        String(row.store_id) !== String(selectedStore)
      ) {
        return false;
      }


      /* 카테고리 */
      if (
        selectedCategory !== "all" &&
        String(row.category) !== String(selectedCategory)
      ) {
        return false;
      }


      return true;
    });
  }, [
    classifiedRows,
    filterType,
    selectedStore,
    selectedCategory,
  ]);


  /* =======================================================
     필터 변경
     ======================================================= */
  const handleFilterChange = (type) => {
    setFilterType(type);
    setCurrentPage(1);
  };


  /* =======================================================
     페이지네이션
     ======================================================= */
  const totalPages = Math.ceil(
    filteredRows.length / itemsPerPage
  );


  const safeCurrentPage =
    totalPages > 0
      ? Math.min(currentPage, totalPages)
      : 1;


  const indexOfLastItem =
    safeCurrentPage * itemsPerPage;


  const indexOfFirstItem =
    indexOfLastItem - itemsPerPage;


  const currentRows = filteredRows.slice(
    indexOfFirstItem,
    indexOfLastItem
  );


  /* =======================================================
     5. 매장별 재고 분포
     ======================================================= */
  const storeDistributions = useMemo(() => {
    return storeIds
      .map((storeId) => {

        const storeData = classifiedRows.filter(
          (row) =>
            String(row.store_id) === String(storeId)
        );


        if (storeData.length === 0) {
          return null;
        }


        const totalCount = storeData.length;


        const shortCount = storeData.filter(
          (row) =>
            row.inventoryStatus === "shortage"
        ).length;


        const excessCount = storeData.filter(
          (row) =>
            row.inventoryStatus === "excess"
        ).length;


        const optimalCount = storeData.filter(
          (row) =>
            row.inventoryStatus === "optimal"
        ).length;


        /* -----------------------------------------------
           퍼센트는 각각 독립 계산
           ----------------------------------------------- */
        const shortPct =
          (shortCount / totalCount) * 100;


        const excessPct =
          (excessCount / totalCount) * 100;


        const optPct =
          (optimalCount / totalCount) * 100;


        /* -----------------------------------------------
           실제 재고 총량
           ----------------------------------------------- */
        const totalStockSum = storeData.reduce(
          (sum, row) =>
            sum + toNumber(row.stock_level_start),
          0
        );


        return {
          storeId,
          storeName: getStoreName(storeId),

          totalStockSum,

          totalCount,

          shortCount,
          optimalCount,
          excessCount,

          shortPct,
          optPct,
          excessPct,
        };
      })
      .filter(Boolean);
  }, [storeIds, classifiedRows]);


  /* =======================================================
     6. 과잉재고 TOP 6
     
     발주 필요 상품은 절대 포함하지 않는다.
     ======================================================= */
  const topExcessItems = useMemo(() => {
    return classifiedRows
      .filter(
        (row) =>
          row.inventoryStatus === "excess"
      )
      .map((row) => {

        const currentStock = toNumber(
          row.stock_level_start
        );

        const recommendedStock = toNumber(
          row.recommended_stock_90
        );


        const excessAmount = Math.max(
          0,
          Math.round(
            currentStock - recommendedStock
          )
        );


        return {
          ...row,
          excessAmount,
        };
      })
      .filter(
        (row) => row.excessAmount > 0
      )
      .sort(
        (a, b) =>
          b.excessAmount - a.excessAmount
      )
      .slice(0, 6);
  }, [classifiedRows]);


  /* =======================================================
     필터 초기화
     
     기준일이나 마트가 바뀌었을 때
     존재하지 않는 필터값 때문에 0건이 되는 문제 방지
     ======================================================= */
  useEffect(() => {
    if (
      selectedStore !== "all" &&
      !storeIds.some(
        (id) =>
          String(id) === String(selectedStore)
      )
    ) {
      setSelectedStore("all");
    }
  }, [storeIds, selectedStore]);


  useEffect(() => {
    if (
      selectedCategory !== "all" &&
      !categoryOptions.some(
        (category) =>
          String(category) ===
          String(selectedCategory)
      )
    ) {
      setSelectedCategory("all");
    }
  }, [
    categoryOptions,
    selectedCategory,
  ]);


  /* =======================================================
     렌더링
     ======================================================= */
  return (
    <div className="inventory-status-page">


      {/* ===================================================
          0. 페이지 헤더
          =================================================== */}
      <div className="page-header-row">

        <div>
          <span className="breadcrumb">
            SmartOrder · {martType}
          </span>

          <h2>
            재고 현황 대시보드
          </h2>

          <p>
            특정 기준일 시점의 매장별 재고 상태를
            진단하고 적정/과잉/부족 여부를 관리합니다.
          </p>
        </div>


        <div className="header-actions">

          <div
            className="filter-group date-picker-group"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >

            <label
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              기준일자:
            </label>


            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 10px",
                borderRadius: "4px",
                border: "1px solid #ddd",
                fontWeight: "bold",
                color: "#1890ff",
              }}
            >
              {availableDates.map((date) => (
                <option
                  key={date}
                  value={date}
                >
                  {date}
                </option>
              ))}
            </select>

          </div>


          <button
            className="btn-balance"
            onClick={() =>
              alert(
                "재고 균형 최적화 시뮬레이션을 실행합니다."
              )
            }
          >
            재고 균형 최적화
          </button>

        </div>

      </div>


      {/* ===================================================
          1. 상단 요약 카드
          =================================================== */}
      <div className="summary-cards-grid">

        <div
          className="summary-card shortage"
          onClick={() =>
            handleFilterChange("shortage")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="card-title">
            발주 필요
          </span>

          <strong className="card-value text-danger">
            {shortageRows.length}건
          </strong>

          <span className="card-desc">
            즉시 발주 대상 상품
          </span>
        </div>


        <div
          className="summary-card optimal"
          onClick={() =>
            handleFilterChange("optimal")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="card-title">
            적정 재고
          </span>

          <strong className="card-value text-success">
            {optimalRows.length}건
          </strong>

          <span className="card-desc">
            권장 범위 내 상품
          </span>
        </div>


        <div
          className="summary-card excess"
          onClick={() =>
            handleFilterChange("excess")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="card-title">
            과잉 재고
          </span>

          <strong className="card-value text-warning">
            {excessRows.length}건
          </strong>

          <span className="card-desc">
            초과 재고 상품
          </span>
        </div>


        <div className="summary-card ratio">
          <span className="card-title">
            재고 적정 비율
          </span>

          <strong className="card-value text-primary">
            {optimalRatio}%
          </strong>

          <span className="card-desc">
            기준일 전체 상품 대비
          </span>
        </div>

      </div>


      {/* ===================================================
          2. 필터
          =================================================== */}
      <div className="filter-dropdown-bar">

        {/* 매장 */}
        <div className="filter-group">

          <label>
            매장
          </label>

          <select
            value={selectedStore}
            onChange={(e) => {
              setSelectedStore(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">
              전체 매장
            </option>

            {storeIds.map((id) => (
              <option
                key={id}
                value={id}
              >
                {getStoreName(id)} ({id})
              </option>
            ))}
          </select>

        </div>


        {/* 카테고리 */}
        <div className="filter-group">

          <label>
            카테고리
          </label>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">
              전체 카테고리
            </option>

            {categoryOptions.map(
              (category) => (
                <option
                  key={category}
                  value={category}
                >
                  {getCategoryName(category)}
                </option>
              )
            )}

          </select>

        </div>


        {/* 상태 */}
        <div className="filter-group">

          <label>
            재고 상태
          </label>

          <select
            value={filterType}
            onChange={(e) =>
              handleFilterChange(
                e.target.value
              )
            }
          >
            <option value="all">
              전체 상태
            </option>

            <option value="shortage">
              발주 필요 (부족)
            </option>

            <option value="optimal">
              적정 재고
            </option>

            <option value="excess">
              과잉 재고
            </option>

          </select>

        </div>

      </div>


      {/* ===================================================
          3. 메인 레이아웃
          =================================================== */}
      <div className="main-layout-grid">


        {/* =================================================
            왼쪽 테이블
            ================================================= */}
        <section className="panel full-width">

          <div className="panel-title-wrap">

            <div>

              <h3>
                현재 재고 vs 권장재고
                {selectedDate
                  ? ` (${selectedDate})`
                  : ""}
              </h3>

              <p className="panel-desc">
                현재 재고와 권장 재고를 비교하여
                상품 상태를 표시합니다.
              </p>

            </div>


            <span className="item-count">
              조회 결과: {filteredRows.length}건
            </span>

          </div>


          {/* 테이블 헤더 */}
          <div className="inventory-table-header">

            <span>상품</span>
            <span>매장</span>
            <span>재고 상태</span>
            <span>현재 재고</span>
            <span>권장 재고</span>
            <span>재고 비교</span>
            <span>관리 조치</span>

          </div>


          {/* 상품 리스트 */}
          <div className="inventory-list">

            {currentRows.length === 0 && (
              <div className="empty">
                조건에 해당하는 재고 상품이 없습니다.
              </div>
            )}


            {currentRows.map(
              (row, index) => {

                const currentStock =
                  Math.round(
                    toNumber(
                      row.stock_level_start
                    )
                  );


                const recommendedStock =
                  Math.round(
                    toNumber(
                      row.recommended_stock_90
                    )
                  );


                /* -----------------------------------------
                   막대그래프
                   실제 값 기준
                   ----------------------------------------- */
                const maxVal = Math.max(
                  currentStock,
                  recommendedStock,
                  1
                );


                const currentWidth =
                  (currentStock / maxVal) *
                  100;


                const recommendedWidth =
                  (recommendedStock / maxVal) *
                  100;


                /* -----------------------------------------
                   상태
                   ----------------------------------------- */
                const status =
                  row.inventoryStatus;


                let badgeType =
                  "success";

                let badgeText =
                  "적정";

                let actionText =
                  "상세 관리";


                if (
                  status === "shortage"
                ) {
                  badgeType =
                    "danger";

                  badgeText =
                    "발주 필요";

                  actionText =
                    "긴급 발주";
                }


                if (
                  status === "excess"
                ) {
                  badgeType =
                    "warning";

                  badgeText =
                    "과잉 재고";

                  actionText =
                    "재고 조정";
                }


                return (
                  <div
                    className="inventory-row-grid"
                    key={`${row.date}-${row.store_id}-${row.product_id}-${index}`}
                  >

                    {/* 상품 */}
                    <div>

                      <strong>
                        {getProductName(
                          row.product_id
                        )}
                      </strong>

                      <div className="sub-code">
                        {row.product_id}
                        {" · "}
                        {getCategoryName(
                          row.category
                        )}
                      </div>

                    </div>


                    {/* 매장 */}
                    <div>
                      {getStoreName(
                        row.store_id
                      )}
                    </div>


                    {/* 상태 */}
                    <div>
                      <Badge
                        type={badgeType}
                      >
                        {badgeText}
                      </Badge>
                    </div>


                    {/* 현재 재고 */}
                    <div>
                      {currentStock.toLocaleString()}
                      개
                    </div>


                    {/* 권장 재고 */}
                    <div>
                      {recommendedStock.toLocaleString()}
                      개
                    </div>


                    {/* 비교 */}
                    <div className="bar-chart-container">

                      <div
                        className="bar current"
                        style={{
                          width: `${Math.min(
                            currentWidth,
                            100
                          )}%`,
                        }}
                        title={`현재: ${currentStock}`}
                      />

                      <div
                        className="bar recommended"
                        style={{
                          width: `${Math.min(
                            recommendedWidth,
                            100
                          )}%`,
                        }}
                        title={`권장: ${recommendedStock}`}
                      />

                    </div>


                    {/* 조치 */}
                    <div>

                      <button
                        className="action-btn"
                        onClick={() =>
                          alert(
                            `[${getProductName(
                              row.product_id
                            )}] ${actionText} 모달창을 엽니다.`
                          )
                        }
                      >
                        {actionText}
                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>


          {/* =================================================
              페이지네이션
              ================================================= */}
          {totalPages > 1 && (

            <div className="inventory-pagination">

              <button
                className="pagination-btn"
                onClick={() =>
                  setCurrentPage(
                    (prev) =>
                      Math.max(
                        prev - 1,
                        1
                      )
                  )
                }
                disabled={
                  safeCurrentPage === 1
                }
              >
                &lt;
              </button>


              {Array.from(
                {
                  length: totalPages,
                },
                (_, i) => i + 1
              ).map((page) => (

                <button
                  key={page}
                  className={`pagination-btn ${
                    safeCurrentPage === page
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    setCurrentPage(page)
                  }
                >
                  {page}
                </button>

              ))}


              <button
                className="pagination-btn"
                onClick={() =>
                  setCurrentPage(
                    (prev) =>
                      Math.min(
                        prev + 1,
                        totalPages
                      )
                  )
                }
                disabled={
                  safeCurrentPage ===
                  totalPages
                }
              >
                &gt;
              </button>

            </div>

          )}

        </section>


        {/* =================================================
            오른쪽 사이드바
            ================================================= */}
        <aside className="side-widgets">


          {/* =================================================
              매장별 재고 분포
              ================================================= */}
          <div className="widget-card">

            <h4>
              매장별 재고 분포
            </h4>

            <p className="widget-desc">
              {selectedDate} 기준 구성 비율
            </p>


            <div className="distribution-list">

              {storeDistributions.map(
                (store) => (

                  <div
                    key={store.storeId}
                  >

                    <div className="dist-info">

                      <span>
                        {store.storeName}
                        {" ("}
                        {store.storeId}
                        {")"}
                      </span>

                      <span>
                        {Math.round(
                          store.totalStockSum
                        ).toLocaleString()}
                        개
                      </span>

                    </div>


                    <div className="dist-bar-bg">

                      <div
                        className="dist-segment short"
                        style={{
                          width: `${store.shortPct}%`,
                        }}
                        title={`발주 필요 ${store.shortCount}건`}
                      />


                      <div
                        className="dist-segment optimal"
                        style={{
                          width: `${store.optPct}%`,
                        }}
                        title={`적정 ${store.optimalCount}건`}
                      />


                      <div
                        className="dist-segment excess"
                        style={{
                          width: `${store.excessPct}%`,
                        }}
                        title={`과잉 ${store.excessCount}건`}
                      />

                    </div>

                  </div>

                )
              )}

            </div>

          </div>


          {/* =================================================
              과잉재고 TOP 6
              ================================================= */}
          <div className="widget-card">

            <h4>
              과잉재고 TOP 6
            </h4>

            <p className="widget-desc">
              권장재고 초과 수량 기준
            </p>


            <div className="top-excess-list">

              {topExcessItems.length === 0 ? (

                <div
                  className="empty"
                  style={{
                    fontSize: "12px",
                  }}
                >
                  과잉 재고 상품이 없습니다.
                </div>

              ) : (

                topExcessItems.map(
                  (item, idx) => (

                    <div
                      className="top-item"
                      key={`${item.store_id}-${item.product_id}-${idx}`}
                    >

                      <span>
                        {getProductName(
                          item.product_id
                        )}
                      </span>

                      <span className="excess-val">
                        +
                        {item.excessAmount.toLocaleString()}
                        개
                      </span>

                    </div>

                  )
                )

              )}

            </div>

          </div>


        </aside>

      </div>

    </div>
  );
}