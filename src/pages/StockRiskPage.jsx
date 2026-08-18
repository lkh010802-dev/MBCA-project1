import React, { useEffect, useMemo, useState } from "react";
import Badge from "../components/common/Badge";
import { getRiskRows } from "../utils/dashboard";
import {
  getProductName,
  getStoreName,
} from "../utils/formatters";
import "./styles/StockRiskPage.css";

export default function StockRiskPage({ data, martType = "A마트" }) {
  const rows = data ? getRiskRows(data) : [];

  // ==========================================
  // 데이터셋 기준일
  // 가장 최근 date 자동 계산
  // ==========================================
  const latestDate = useMemo(() => {
    if (!rows.length) return "";

    const dates = rows
      .map((row) => row?.date)
      .filter(Boolean)
      .map((date) => String(date).trim())
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));

    if (!dates.length) return "";

    return dates.sort((a, b) => a.localeCompare(b)).at(-1);
  }, [rows]);

  // ==========================================
  // 매장 목록
  // 현재 선택된 데이터셋에서 자동 생성
  // ==========================================
  const stores = useMemo(() => {
    const storeIds = [
      ...new Set(
        rows
          .map((row) => row?.store_id)
          .filter(Boolean)
          .map((id) => String(id).trim())
      ),
    ];

    return storeIds.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // 상태 관리
  const [filterType, setFilterType] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 마트가 변경되면 매장 필터 초기화
  useEffect(() => {
    setSelectedStore("all");
    setFilterType("all");
    setSearchQuery("");
  }, [martType]);

  // 데이터셋 자체가 변경될 때
  // 현재 선택된 매장이 존재하지 않으면 전체 매장으로 초기화
  useEffect(() => {
    if (
      selectedStore !== "all" &&
      !stores.includes(selectedStore)
    ) {
      setSelectedStore("all");
    }
  }, [stores, selectedStore]);

  // ==========================================
  // 필터링 및 검색
  // ==========================================
  const filteredRows = rows.filter((row) => {
    const isUrgent =
      row.stock_level_start <= row.reorder_point_90 ||
      row.reorder_flag_90 === 1;

    if (filterType === "urgent" && !isUrgent) {
      return false;
    }

    if (
      selectedStore !== "all" &&
      String(row.store_id) !== selectedStore
    ) {
      return false;
    }

    if (searchQuery.trim() !== "") {
      const prodName = getProductName(row.product_id).toLowerCase();
      const prodId = String(row.product_id).toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      if (
        !prodName.includes(query) &&
        !prodId.includes(query)
      ) {
        return false;
      }
    }

    return true;
  });

  // ==========================================
  // KPI 요약
  // ==========================================
  const urgentCount = rows.filter(
    (row) =>
      row.stock_level_start <= row.reorder_point_90 ||
      row.reorder_flag_90 === 1
  ).length;

  const normalCount = rows.length - urgentCount;

  const totalDeficit = rows.reduce((acc, row) => {
    const diff = Math.round(
      row.reorder_point_90 - row.stock_level_start
    );

    return acc + (diff > 0 ? diff : 0);
  }, 0);

  const repeatedStockoutCount = rows.filter(
    (row) => (row.lost_sales_qty || 0) > 0
  ).length;

  // ==========================================
  // 반복 결품 TOP 6
  // ==========================================
  const topRankingRows = [...rows]
    .sort(
      (a, b) =>
        (b.lost_sales_qty || 0) -
        (a.lost_sales_qty || 0)
    )
    .slice(0, 6);

  const maxLostSales =
    topRankingRows.length > 0
      ? topRankingRows[0].lost_sales_qty || 1
      : 1;

  return (
    <div className="stock-risk-page">

      {/* ==========================================
          상단 타이틀
          ========================================== */}
      <header className="dashboard-header">
        <div className="header-title-group">

          {/* A마트 / B마트 자동 변경 */}
          <span className="breadcrumb">
            SmartOrder · {martType}
          </span>

          {/* A마트 / B마트 자동 변경 */}
          <h1>{martType} 품절 위험</h1>

          <p>
            매장·상품별 위험 신호와 예상 부족 수량을
            한 화면에서 확인합니다.
          </p>
        </div>

        <div className="header-badge-group">

          <button className="monitor-link-btn">
            위험 모니터링
          </button>

          {/* 데이터셋의 가장 최근 날짜 */}
          <span className="기준일">
            기준일 {latestDate || "-"}
          </span>

        </div>
      </header>


      {/* ==========================================
          상단 요약 KPI
          ========================================== */}
      <section className="kpi-cards-grid">

        <div className="kpi-card urgent">
          <span className="kpi-label">
            긴급 상품
          </span>

          <div className="kpi-value">
            <strong>{urgentCount.toLocaleString()}</strong>
            {" "}개
          </div>

          <span className="kpi-desc">
            즉시 발주 검토
          </span>
        </div>


        <div className="kpi-card warning">
          <span className="kpi-label">
            주의 상품
          </span>

          <div className="kpi-value">
            <strong>0</strong>
            {" "}개
          </div>

          <span className="kpi-desc">
            재고 추이 확인
          </span>
        </div>


        <div className="kpi-card">
          <span className="kpi-label">
            예상 총 부족
          </span>

          <div className="kpi-value">
            <strong>
              {totalDeficit.toLocaleString()}
            </strong>
            {" "}개
          </div>

          <span className="kpi-desc">
            현재 목표재고 기준
          </span>
        </div>


        <div className="kpi-card">
          <span className="kpi-label">
            반복 결품 집중 상품
          </span>

          <div className="kpi-value">
            <strong>
              {repeatedStockoutCount.toLocaleString()}
            </strong>
            {" "}개
          </div>

          <span className="kpi-desc">
            결품 발생 상품 기준
          </span>
        </div>

      </section>


      {/* ==========================================
          필터 및 검색
          ========================================== */}
      <section className="filter-search-bar">

        <div className="filter-group">
          <label>매장</label>

          <select
            value={selectedStore}
            onChange={(e) =>
              setSelectedStore(e.target.value)
            }
          >
            <option value="all">
              전체 매장
            </option>

            {stores.map((storeId) => (
              <option
                key={storeId}
                value={storeId}
              >
                {getStoreName(storeId)}
              </option>
            ))}
          </select>
        </div>


        <div className="filter-group">
          <label>위험 상태</label>

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

            <button className="disabled">
              주의
            </button>

            <button className="disabled">
              정상
            </button>

          </div>
        </div>


        <div className="search-group">

          <label>상품 검색</label>

          <input
            type="text"
            placeholder="상품명 또는 상품 ID"
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
          />

        </div>

      </section>


      {/* ==========================================
          메인 콘텐츠
          ========================================== */}
      <div className="dashboard-main-layout">

        {/* ==========================================
            좌측 : 상품별 품절 위험
            ========================================== */}
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
                  <th>상품</th>
                  <th>매장</th>
                  <th>상태</th>
                  <th>현재 재고</th>
                  <th>권장 재고</th>
                  <th>예상 부족</th>
                  <th>예상 품절일</th>
                  <th>최근 결품</th>
                </tr>
              </thead>


              <tbody>

                {filteredRows.length === 0 ? (

                  <tr>
                    <td
                      colSpan="8"
                      className="empty-row"
                    >
                      조건에 해당하는 품절 위험
                      상품이 없습니다.
                    </td>
                  </tr>

                ) : (

                  filteredRows.map((row) => {

                    const deficit =
                      Math.round(
                        row.reorder_point_90 -
                        row.stock_level_start
                      );

                    return (
                      <tr
                        key={`${row.date}-${row.store_id}-${row.product_id}`}
                      >

                        <td>
                          <div className="table-product-info">
                            <strong>
                              {getProductName(
                                row.product_id
                              )}
                            </strong>
                          </div>
                        </td>

                        <td>
                          {getStoreName(
                            row.store_id
                          )}
                        </td>

                        <td>
                          <Badge type="danger">
                            긴급
                          </Badge>
                        </td>

                        <td>
                          {Math.round(
                            row.stock_level_start
                          ).toLocaleString()}
                        </td>

                        <td>
                          {Math.round(
                            row.reorder_point_90
                          ).toLocaleString()}
                        </td>

                        <td className="text-danger font-bold">
                          -
                          {deficit > 0
                            ? deficit.toLocaleString()
                            : 0}
                        </td>

                        <td>
                          {row.date || "-"}
                        </td>

                        <td>
                          {Math.round(
                            row.lost_sales_qty || 0
                          )}
                          회 / 30일
                        </td>

                      </tr>
                    );
                  })

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* ==========================================
            우측 사이드바
            ========================================== */}
        <aside className="dashboard-sidebar">


          {/* 위험 상태 분포 */}
          <div className="sidebar-card">

            <h4>
              위험 상태 분포
            </h4>

            <span className="sidebar-sub">
              전체 상품 기준
            </span>


            <div className="donut-chart-placeholder">

              <div className="donut-center-text">

                <strong>
                  {rows.length.toLocaleString()}
                </strong>

                <span>
                  전체 상품
                </span>

              </div>

            </div>


            <ul className="chart-legend">

              <li>
                <span className="dot urgent"></span>
                {" "}긴급
                {" "}
                <span className="count">
                  {urgentCount.toLocaleString()}
                </span>
              </li>

              <li>
                <span className="dot warning"></span>
                {" "}주의
                {" "}
                <span className="count">
                  0
                </span>
              </li>

              <li>
                <span className="dot normal"></span>
                {" "}정상
                {" "}
                <span className="count">
                  {normalCount.toLocaleString()}
                </span>
              </li>

            </ul>

          </div>


          {/* 반복 결품 TOP 6 */}
          <div className="sidebar-card">

            <h4>
              반복 결품 TOP 6
            </h4>

            <span className="sidebar-sub">
              최근 30일 발생 빈도
            </span>


            <div className="top-ranking-list">

              {topRankingRows.map((row) => {

                const percentage = Math.round(
                  ((row.lost_sales_qty || 0) /
                    maxLostSales) *
                    100
                );

                return (
                  <div
                    className="ranking-item"
                    key={`${row.store_id}-${row.product_id}`}
                  >

                    <div className="rank-info">

                      <span>
                        {getProductName(
                          row.product_id
                        )}
                        {" "}
                        (
                        {getStoreName(
                          row.store_id
                        )}
                        )
                      </span>

                      <strong>
                        {Math.round(
                          row.lost_sales_qty || 0
                        )}
                        회
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
              })}

            </div>

          </div>

        </aside>

      </div>

    </div>
  );
}