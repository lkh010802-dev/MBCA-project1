import React, { useEffect, useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import { getRiskRows } from "../utils/dashboard";
import {
  getProductName,
  getStoreName,
} from "../utils/formatters";
import "./styles/StockRiskPage.css";

export default function StockRiskPage({
  data,
  martType = "A마트",
}) {
  // =========================================================
  // 기본 데이터
  //
  // 중요:
  // 품절 위험 페이지에서는 전체 기간의 데이터를
  // 현재 상태처럼 사용하면 안 됩니다.
  //
  // 가능한 경우 data 원본 배열을 그대로 사용합니다.
  // 기존 구조가 배열이 아닌 경우에만 getRiskRows를 fallback으로 사용합니다.
  // =========================================================
  const rows = useMemo(() => {
    if (!data) return [];

    // 일반적인 현재 프로젝트 구조
    if (Array.isArray(data)) {
      return data;
    }

    // 혹시 data.rows 구조인 경우
    if (Array.isArray(data.rows)) {
      return data.rows;
    }

    // 혹시 data.data 구조인 경우
    if (Array.isArray(data.data)) {
      return data.data;
    }

    // 혹시 data.records 구조인 경우
    if (Array.isArray(data.records)) {
      return data.records;
    }

    // 기존 구조 fallback
    const fallback = getRiskRows(data);

    return Array.isArray(fallback)
      ? fallback
      : [];
  }, [data]);

  // =========================================================
  // 숫자 변환
  // =========================================================
  const toNumber = (value, defaultValue = 0) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : defaultValue;
  };

  // =========================================================
  // 날짜 변환
  // =========================================================
  const normalizeDate = (value) => {
    if (!value) return "";

    const text = String(value).trim();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(text)
    ) {
      return "";
    }

    return text;
  };

  // =========================================================
  // 데이터셋 기준일
  //
  // 전체 데이터 중 가장 최근 날짜
  // =========================================================
  const latestDate = useMemo(() => {
    if (!rows.length) return "";

    const dates = rows
      .map((row) =>
        normalizeDate(row?.date)
      )
      .filter(Boolean);

    if (!dates.length) return "";

    return [...new Set(dates)]
      .sort((a, b) =>
        a.localeCompare(b)
      )
      .at(-1);
  }, [rows]);

  // =========================================================
  // 현재 재고 상태
  //
  // 중요:
  // 전체 과거 데이터를 현재 상태로 사용하지 않습니다.
  //
  // 가장 최근 기준일의
  // 매장 + 상품 데이터를 현재 상태로 사용합니다.
  // =========================================================
  const latestRows = useMemo(() => {
    if (!rows.length || !latestDate) {
      return [];
    }

    const currentRows = rows.filter(
      (row) =>
        normalizeDate(row?.date) ===
        latestDate
    );

    // 혹시 같은 날짜에 동일 매장/상품이
    // 중복으로 존재한다면 마지막 행 하나만 사용
    const uniqueMap = new Map();

    currentRows.forEach((row, index) => {
      const key = [
        String(row?.store_id ?? ""),
        String(row?.product_id ?? ""),
      ].join("|");

      uniqueMap.set(
        key,
        {
          ...row,
          originalIndex: index,
        }
      );
    });

    return [...uniqueMap.values()];
  }, [rows, latestDate]);

  // =========================================================
  // 매장 목록
  // =========================================================
  const stores = useMemo(() => {
    const storeIds = [
      ...new Set(
        latestRows
          .map((row) => row?.store_id)
          .filter(
            (id) =>
              id !== null &&
              id !== undefined &&
              String(id).trim() !== ""
          )
          .map((id) =>
            String(id).trim()
          )
      ),
    ];

    return storeIds.sort((a, b) =>
      a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
        }
      )
    );
  }, [latestRows]);

  // =========================================================
  // 상태 관리
  // =========================================================
  const [filterType, setFilterType] =
    useState("all");

  const [selectedStore, setSelectedStore] =
    useState("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  // =========================================================
  // 마트 변경 시 필터 초기화
  // =========================================================
  useEffect(() => {
    setSelectedStore("all");
    setFilterType("all");
    setSearchQuery("");
  }, [martType]);

  // =========================================================
  // 데이터 변경 시
  // 현재 선택 매장이 존재하지 않으면 전체 매장
  // =========================================================
  useEffect(() => {
    if (
      selectedStore !== "all" &&
      !stores.includes(selectedStore)
    ) {
      setSelectedStore("all");
    }
  }, [
    stores,
    selectedStore,
  ]);

  // =========================================================
  // 위험 상태 계산
  //
  // 기존 문제:
  //
  // 전체 상품을
  // 30% / 40% / 30%
  // 또는
  // 30% / 70%
  // 로 강제로 나누면
  // 실제 재고 상태와 관계없는 위험도가 만들어집니다.
  //
  // 현재 로직:
  //
  // 1. 재고 <= 0
  //    → 긴급
  //
  // 2. 현재 재고 <= 안전재고
  //    → 긴급
  //
  // 3. 발주 필요(reorder_flag_90=1)이면서
  //    최근 결품도 발생
  //    → 긴급
  //
  // 4. reorder_flag_90=1
  //    → 주의
  //
  // 5. 그 외
  //    → 정상
  //
  // 이 방식은 이미 데이터셋에서 계산된
  // 안전재고 / 재주문점 / 발주 필요 여부를 사용합니다.
  // =========================================================
  const classifiedRows = useMemo(() => {
    return latestRows.map((row) => {
      // -----------------------------------------------------
      // 현재 재고
      // -----------------------------------------------------
      const currentStock = Math.max(
        0,
        Math.round(
          toNumber(
            row.stock_level_start
          )
        )
      );

      // -----------------------------------------------------
      // 재주문점
      // -----------------------------------------------------
      const reorderPoint = Math.max(
        0,
        toNumber(
          row.reorder_point_90
        )
      );

      // -----------------------------------------------------
      // 안전재고
      // -----------------------------------------------------
      const safetyStock = Math.max(
        0,
        toNumber(
          row.safety_stock_90
        )
      );

      // -----------------------------------------------------
      // 최근 결품 수량
      //
      // 이것은 "횟수"가 아니라 수량입니다.
      // -----------------------------------------------------
      const lostSales = Math.max(
        0,
        Math.round(
          toNumber(
            row.lost_sales_qty
          )
        )
      );

      // -----------------------------------------------------
      // 데이터셋이 계산한 발주 필요 여부
      // -----------------------------------------------------
      const reorderFlag =
        toNumber(
          row.reorder_flag_90
        ) > 0;

      // -----------------------------------------------------
      // 권장 발주량
      //
      // order_qty_90이 존재하면 이것을 사용.
      // 없으면 재주문점 - 현재재고를 fallback으로 사용.
      // -----------------------------------------------------
      let orderQty = Math.max(
        0,
        Math.round(
          toNumber(
            row.order_qty_90
          )
        )
      );

      if (
        orderQty === 0 &&
        reorderPoint > currentStock
      ) {
        orderQty = Math.max(
          0,
          Math.round(
            reorderPoint -
              currentStock
          )
        );
      }

      // -----------------------------------------------------
      // 재고 비율
      //
      // 화면 분석용으로만 보관
      // 위험도 분류의 핵심 기준은 아님
      // -----------------------------------------------------
      const stockRatio =
        reorderPoint > 0
          ? currentStock /
            reorderPoint
          : 1;

      // -----------------------------------------------------
      // 위험 상태
      // -----------------------------------------------------
      let riskStatus = "normal";

      // 1. 완전 품절
      if (currentStock <= 0) {
        riskStatus = "urgent";
      }

      // 2. 안전재고 이하
      else if (
        safetyStock > 0 &&
        currentStock <= safetyStock
      ) {
        riskStatus = "urgent";
      }

      // 3. 발주 필요 + 결품 발생
      else if (
        reorderFlag &&
        lostSales > 0
      ) {
        riskStatus = "urgent";
      }

      // 4. 발주 필요
      else if (reorderFlag) {
        riskStatus = "warning";
      }

      // 5. 정상
      else {
        riskStatus = "normal";
      }

      return {
        ...row,

        currentStock,
        reorderPoint,
        safetyStock,
        lostSales,
        reorderFlag,
        orderQty,
        stockRatio,

        riskStatus,
      };
    });
  }, [latestRows]);

  // =========================================================
  // 상태 라벨
  // =========================================================
  const getStatusLabel = (
    status
  ) => {
    switch (status) {
      case "urgent":
        return "긴급";

      case "warning":
        return "주의";

      case "normal":
        return "정상";

      default:
        return "정상";
    }
  };

  // =========================================================
  // Badge 타입
  // =========================================================
  const getBadgeType = (
    status
  ) => {
    switch (status) {
      case "urgent":
        return "danger";

      case "warning":
        return "warning";

      case "normal":
        return "success";

      default:
        return "success";
    }
  };

  // =========================================================
  // KPI - 긴급
  // =========================================================
  const urgentCount = useMemo(() => {
    return classifiedRows.filter(
      (row) =>
        row.riskStatus ===
        "urgent"
    ).length;
  }, [classifiedRows]);

  // =========================================================
  // KPI - 주의
  // =========================================================
  const warningCount = useMemo(() => {
    return classifiedRows.filter(
      (row) =>
        row.riskStatus ===
        "warning"
    ).length;
  }, [classifiedRows]);

  // =========================================================
  // KPI - 정상
  // =========================================================
  const normalCount = useMemo(() => {
    return classifiedRows.filter(
      (row) =>
        row.riskStatus ===
        "normal"
    ).length;
  }, [classifiedRows]);

  // =========================================================
  // 총 보충 필요 수량
  //
  // 중요:
  //
  // 단순히
  // reorder_point - stock
  // 을 더하는 것보다
  //
  // 데이터셋에서 이미 계산된
  // order_qty_90을 사용하는 것이
  // 실제 발주 의사결정에 더 적합합니다.
  // =========================================================
  const totalOrderQty = useMemo(() => {
    return classifiedRows.reduce(
      (total, row) =>
        total + row.orderQty,
      0
    );
  }, [classifiedRows]);

  // =========================================================
  // 최근 30일 범위
  // =========================================================
  const recent30Rows = useMemo(() => {
    if (!rows.length || !latestDate) {
      return [];
    }

    const latestTime = new Date(
      `${latestDate}T00:00:00`
    ).getTime();

    const startTime =
      latestTime -
      29 * 24 * 60 * 60 * 1000;

    return rows.filter(
      (row) => {
        const date =
          normalizeDate(
            row?.date
          );

        if (!date) return false;

        const time = new Date(
          `${date}T00:00:00`
        ).getTime();

        return (
          time >= startTime &&
          time <= latestTime
        );
      }
    );
  }, [
    rows,
    latestDate,
  ]);

  // =========================================================
  // 최근 30일 결품 집계
  //
  // store + product 기준
  //
  // lost_sales_qty:
  //   최근 30일 결품 수량 합계
  //
  // stockoutDays:
  //   결품이 실제 발생한 날짜 수
  //
  // 이렇게 해야
  // "반복 결품"을 제대로 판단할 수 있습니다.
  // =========================================================
  const stockoutAggregates =
    useMemo(() => {
      const map = new Map();

      recent30Rows.forEach(
        (row) => {
          const storeId =
            String(
              row?.store_id ??
                ""
            ).trim();

          const productId =
            String(
              row?.product_id ??
                ""
            ).trim();

          if (
            !storeId ||
            !productId
          ) {
            return;
          }

          const key =
            `${storeId}|${productId}`;

          if (!map.has(key)) {
            map.set(
              key,
              {
                store_id:
                  storeId,

                product_id:
                  productId,

                lostSales30d: 0,

                stockoutDays: 0,
              }
            );
          }

          const item =
            map.get(key);

          const lostSales =
            Math.max(
              0,
              Math.round(
                toNumber(
                  row?.lost_sales_qty
                )
              )
            );

          item.lostSales30d +=
            lostSales;

          if (
            lostSales > 0
          ) {
            item.stockoutDays +=
              1;
          }
        }
      );

      return [...map.values()];
    }, [recent30Rows]);

  // =========================================================
  // 최근 30일 결품 발생 상품 수
  //
  // 결품 수량이 1개라도 발생한
  // 매장 + 상품 조합
  // =========================================================
  const stockoutProductCount =
    useMemo(() => {
      return stockoutAggregates.filter(
        (item) =>
          item.lostSales30d > 0
      ).length;
    }, [
      stockoutAggregates,
    ]);

  // =========================================================
  // 반복 결품 상품
  //
  // 30일 동안 2일 이상 결품 발생
  // =========================================================
  const repeatedStockoutCount =
    useMemo(() => {
      return stockoutAggregates.filter(
        (item) =>
          item.stockoutDays >= 2
      ).length;
    }, [
      stockoutAggregates,
    ]);

  // =========================================================
  // 결품 집중 TOP 6
  //
  // 최근 30일 결품 수량이 많은 순서
  // =========================================================
  const topRankingRows =
    useMemo(() => {
      return [...stockoutAggregates]
        .filter(
          (item) =>
            item.lostSales30d > 0
        )
        .sort(
          (a, b) =>
            b.lostSales30d -
            a.lostSales30d
        )
        .slice(0, 6);
    }, [
      stockoutAggregates,
    ]);

  // =========================================================
  // TOP 6 최대 결품량
  // =========================================================
  const maxLostSales =
    useMemo(() => {
      if (
        !topRankingRows.length
      ) {
        return 1;
      }

      return Math.max(
        1,
        topRankingRows[0]
          .lostSales30d
      );
    }, [
      topRankingRows,
    ]);

  // =========================================================
  // 필터링
  // =========================================================
  const filteredRows =
    useMemo(() => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      return classifiedRows.filter(
        (row) => {
          // -------------------------------------------------
          // 위험 상태
          // -------------------------------------------------
          if (
            filterType !==
              "all" &&
            row.riskStatus !==
              filterType
          ) {
            return false;
          }

          // -------------------------------------------------
          // 매장
          // -------------------------------------------------
          if (
            selectedStore !==
              "all" &&
            String(
              row.store_id
            ) !==
              selectedStore
          ) {
            return false;
          }

          // -------------------------------------------------
          // 상품 검색
          // -------------------------------------------------
          if (query !== "") {
            const productName =
              getProductName(
                row.product_id
              ).toLowerCase();

            const productId =
              String(
                row.product_id
              ).toLowerCase();

            if (
              !productName.includes(
                query
              ) &&
              !productId.includes(
                query
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      classifiedRows,
      filterType,
      selectedStore,
      searchQuery,
    ]);

  // =========================================================
  // 화면
  // =========================================================
  return (
    <div className="stock-risk-page">

      {/* =====================================================
          상단 타이틀
          ===================================================== */}
      <header className="dashboard-header">

        <div className="header-title-group">

          <span className="breadcrumb">
            SmartOrder · {martType}
          </span>

          <h1>
            {martType} 품절 위험
          </h1>

          <p>
            매장·상품별 현재 재고 위험과
            보충 필요 수량을 확인합니다.
          </p>

        </div>

        <div className="header-badge-group">

          <button
            className="monitor-link-btn"
          >
            위험 모니터링
          </button>

          <span className="기준일">
            기준일{" "}
            {latestDate || "-"}
          </span>

        </div>

      </header>


      {/* =====================================================
          KPI
          ===================================================== */}
      <section className="kpi-cards-grid">

        {/* 긴급 */}
        <div className="kpi-card urgent">

          <span className="kpi-label">
            긴급 상품
          </span>

          <div className="kpi-value">

            <strong>
              {urgentCount.toLocaleString()}
            </strong>

            {" "}개

          </div>

          <span className="kpi-desc">
            품절·안전재고 이하·결품 동반 발주 필요
          </span>

        </div>


        {/* 주의 */}
        <div className="kpi-card warning">

          <span className="kpi-label">
            주의 상품
          </span>

          <div className="kpi-value">

            <strong>
              {warningCount.toLocaleString()}
            </strong>

            {" "}개

          </div>

          <span className="kpi-desc">
            재주문점 이하로 발주 검토 필요
          </span>

        </div>


        {/* 총 보충 필요 */}
        <div className="kpi-card">

          <span className="kpi-label">
            총 보충 필요 수량
          </span>

          <div className="kpi-value">

            <strong>
              {totalOrderQty.toLocaleString()}
            </strong>

            {" "}개

          </div>

          <span className="kpi-desc">
            권장 발주량 기준
          </span>

        </div>


        {/* 결품 발생 */}
        <div className="kpi-card">

          <span className="kpi-label">
            반복 결품 상품
          </span>

          <div className="kpi-value">

            <strong>
              {repeatedStockoutCount.toLocaleString()}
            </strong>

            {" "}개

          </div>

          <span className="kpi-desc">
            최근 30일 결품 2일 이상 발생
          </span>

        </div>

      </section>


      {/* =====================================================
          필터
          ===================================================== */}
      <section className="filter-search-bar">

        <div className="filter-group">

          <label>
            매장
          </label>

          <select
            value={selectedStore}
            onChange={(e) =>
              setSelectedStore(
                e.target.value
              )
            }
          >

            <option value="all">
              전체 매장
            </option>

            {stores.map(
              (storeId) => (
                <option
                  key={storeId}
                  value={storeId}
                >
                  {getStoreName(
                    storeId
                  )}
                </option>
              )
            )}

          </select>

        </div>


        <div className="filter-group">

          <label>
            위험 상태
          </label>

          <div className="status-filter-buttons">

            <button
              className={
                filterType === "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilterType("all")
              }
            >
              전체
            </button>

            <button
              className={
                filterType === "urgent"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilterType("urgent")
              }
            >
              긴급
            </button>

            <button
              className={
                filterType === "warning"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilterType("warning")
              }
            >
              주의
            </button>

            <button
              className={
                filterType === "normal"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setFilterType("normal")
              }
            >
              정상
            </button>

          </div>

        </div>


        <div className="search-group">

          <label>
            상품 검색
          </label>

          <input
            type="text"
            placeholder="상품명 또는 상품 ID"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(
                e.target.value
              )
            }
          />

        </div>

      </section>


      {/* =====================================================
          메인
          ===================================================== */}
      <div className="dashboard-main-layout">


        {/* ===================================================
            상품별 품절 위험
            =================================================== */}
        <section className="panel table-panel">

          <div className="panel-header-row">

            <h3>
              상품별 품절 위험
            </h3>

            <span className="sub-count">

              {filteredRows.length.toLocaleString()}

              개 상품이 조회되었습니다.

            </span>

          </div>


          <div className="data-table-container">

            <table className="risk-data-table">

              <thead>

                <tr>

                  <th>
                    상품
                  </th>

                  <th>
                    매장
                  </th>

                  <th>
                    상태
                  </th>

                  <th>
                    현재 재고
                  </th>

                  <th>
                    안전재고
                  </th>

                  <th>
                    재주문점
                  </th>

                  <th>
                    보충 필요
                  </th>

                  <th>
                    기준일
                  </th>

                  <th>
                    최근 결품
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredRows.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan="9"
                      className="empty-row"
                    >
                      조건에 해당하는
                      품절 위험 상품이
                      없습니다.
                    </td>

                  </tr>

                ) : (

                  filteredRows.map(
                    (row) => (

                      <tr
                        key={`${row.date}-${row.store_id}-${row.product_id}-${row.originalIndex}`}
                      >

                        {/* 상품 */}
                        <td>

                          <div className="table-product-info">

                            <strong>
                              {getProductName(
                                row.product_id
                              )}
                            </strong>

                          </div>

                        </td>


                        {/* 매장 */}
                        <td>

                          {getStoreName(
                            row.store_id
                          )}

                        </td>


                        {/* 상태 */}
                        <td>

                          <Badge
                            type={getBadgeType(
                              row.riskStatus
                            )}
                          >
                            {getStatusLabel(
                              row.riskStatus
                            )}
                          </Badge>

                        </td>


                        {/* 현재 재고 */}
                        <td>

                          {row.currentStock.toLocaleString()}

                        </td>


                        {/* 안전재고 */}
                        <td>

                          {Math.round(
                            row.safetyStock
                          ).toLocaleString()}

                        </td>


                        {/* 재주문점 */}
                        <td>

                          {Math.round(
                            row.reorderPoint
                          ).toLocaleString()}

                        </td>


                        {/* 보충 필요 */}
                        <td
                          className={
                            row.orderQty > 0
                              ? "text-danger font-bold"
                              : ""
                          }
                        >

                          {row.orderQty > 0
                            ? `+${row.orderQty.toLocaleString()}`
                            : "0"}

                        </td>


                        {/* 기준일 */}
                        <td>

                          {row.date || "-"}

                        </td>


                        {/* 최근 결품 */}
                        <td>

                          {row.lostSales.toLocaleString()}

                          {" "}개

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ===================================================
            우측 사이드바
            =================================================== */}
        <aside className="dashboard-sidebar">


          {/* =================================================
              위험 상태 분포
              ================================================= */}
          <div className="sidebar-card">

            <h4>
              위험 상태 분포
            </h4>

            <span className="sidebar-sub">
              최신 기준일 상품 기준
            </span>


            <div className="donut-chart-placeholder">

              <div className="donut-center-text">

                <strong>
                  {classifiedRows.length.toLocaleString()}
                </strong>

                <span>
                  전체 상품
                </span>

              </div>

            </div>


            <ul className="chart-legend">

              <li>

                <span className="dot urgent"></span>

                {" "}긴급{" "}

                <span className="count">
                  {urgentCount.toLocaleString()}
                </span>

              </li>


              <li>

                <span className="dot warning"></span>

                {" "}주의{" "}

                <span className="count">
                  {warningCount.toLocaleString()}
                </span>

              </li>


              <li>

                <span className="dot normal"></span>

                {" "}정상{" "}

                <span className="count">
                  {normalCount.toLocaleString()}
                </span>

              </li>

            </ul>

          </div>


          {/* =================================================
              결품 집중 TOP 6
              ================================================= */}
          <div className="sidebar-card">

            <h4>
              결품 집중 TOP 6
            </h4>

            <span className="sidebar-sub">
              최근 30일 결품 수량 기준
            </span>


            <div className="top-ranking-list">

              {topRankingRows.length ===
              0 ? (

                <div className="empty-ranking">
                  최근 30일 결품 발생 상품이 없습니다.
                </div>

              ) : (

                topRankingRows.map(
                  (item) => {

                    const percentage =
                      Math.round(
                        (
                          item.lostSales30d /
                          maxLostSales
                        ) *
                        100
                      );

                    return (

                      <div
                        className="ranking-item"
                        key={`${item.store_id}-${item.product_id}`}
                      >

                        <div className="rank-info">

                          <span>

                            {getProductName(
                              item.product_id
                            )}

                            {" "}

                            (
                            {getStoreName(
                              item.store_id
                            )}
                            )

                          </span>

                          <strong>

                            {item.lostSales30d.toLocaleString()}

                            {" "}개

                          </strong>

                        </div>


                        <div
                          className="rank-bar"
                          style={{
                            width: `${percentage}%`,
                          }}
                        />

                      </div>

                    );
                  }
                )

              )}

            </div>

          </div>


          {/* =================================================
              결품 현황
              ================================================= */}
          <div className="sidebar-card">

            <h4>
              결품 현황
            </h4>

            <span className="sidebar-sub">
              최근 30일 기준
            </span>


            <div className="stockout-summary">


              <div className="stockout-summary-row">

                <span>
                  결품 발생 상품
                </span>

                <strong>
                  {stockoutProductCount.toLocaleString()}
                </strong>

              </div>


              <div className="stockout-summary-row">

                <span>
                  반복 결품 상품
                </span>

                <strong>
                  {repeatedStockoutCount.toLocaleString()}
                </strong>

              </div>


              <div className="stockout-summary-row">

                <span>
                  결품 수량
                </span>

                <strong>

                  {stockoutAggregates
                    .reduce(
                      (
                        total,
                        item
                      ) =>
                        total +
                        item.lostSales30d,
                      0
                    )
                    .toLocaleString()}

                  {" "}개

                </strong>

              </div>

            </div>

          </div>

        </aside>

      </div>

    </div>
  );
}