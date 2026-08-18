import React, { useState, useEffect } from "react";

import Dashboard from "./pages/Dashboard";
import StockRiskPage from "./pages/StockRiskPage";
import InventoryStatusPage from "./pages/InventoryStatusPage";
import DemandAnalysisPage from "./pages/DemandAnalysisPage";
import PurchaseManagementPage from "./pages/PurchaseManagementPage";

import { loadDashboardCsv } from "./utils/csv";

import "./App.css";

export default function App() {
  const [activeMenu, setActiveMenu] = useState("대시보드");
  const [martType, setMartType] = useState("A마트");

  // ==========================================
  // 데이터 및 로딩 상태
  // ==========================================
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================
  // 모델 성능 모달 상태
  // ==========================================
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] =
    useState(false);

  const [performanceData, setPerformanceData] = useState({
    headers: [],
    rows: [],
  });

  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState("");

  // ==========================================
  // 모델 성능 CSV 파일
  // ==========================================
  const MODEL_PERFORMANCE_FILES = {
    "A마트": "/A_mart_v2_quantile_rolling_validation.csv",
    "B마트": "/Bmart_v2_quantile_rolling_validation.csv",
  };

  // ==========================================
  // 마트별 데이터 불러오기
  // ==========================================
  useEffect(() => {
    setLoading(true);
    setError("");

    const source =
      martType === "B마트"
        ? "/bmart_dashboard_data.csv"
        : "/dashboard_full_data.csv";

    loadDashboardCsv(source)
      .then(setData)
      .catch((err) => {
        console.error(err);
        setError("데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [martType]);

  // ==========================================
  // CSV 파서
  // ==========================================
  const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      // 큰따옴표 안의 "" 처리
      if (char === '"' && insideQuotes && next === '"') {
        cell += '"';
        i++;
        continue;
      }

      // 큰따옴표 시작 / 종료
      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      // 쉼표
      if (char === "," && !insideQuotes) {
        row.push(cell.trim());
        cell = "";
        continue;
      }

      // 줄바꿈
      if (
        (char === "\n" || char === "\r") &&
        !insideQuotes
      ) {
        if (char === "\r" && next === "\n") {
          i++;
        }

        row.push(cell.trim());
        cell = "";

        if (row.some((value) => value !== "")) {
          rows.push(row);
        }

        row = [];
        continue;
      }

      cell += char;
    }

    // 마지막 행
    if (cell !== "" || row.length > 0) {
      row.push(cell.trim());

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
    }

    return rows;
  };

  // ==========================================
  // 모델 성능 모달 열기
  // ==========================================
  const handleModelPerformance = async () => {
    const performanceFile =
      MODEL_PERFORMANCE_FILES[martType];

    // 파일 설정 확인
    if (!performanceFile) {
      setPerformanceError(
        `${martType} 모델 성능 데이터 파일이 설정되어 있지 않습니다.`
      );

      setIsPerformanceModalOpen(true);

      return;
    }

    // 모달 열기
    setIsPerformanceModalOpen(true);

    // 기존 데이터 초기화
    setPerformanceData({
      headers: [],
      rows: [],
    });

    // 로딩 시작
    setPerformanceLoading(true);

    // 기존 에러 초기화
    setPerformanceError("");

    try {
      // ==========================================
      // CSV 읽기
      // ==========================================
      const response = await fetch(
        performanceFile,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `성능 데이터 파일을 불러오지 못했습니다. (${response.status})`
        );
      }

      const text = await response.text();

      // 빈 파일 확인
      if (!text.trim()) {
        throw new Error(
          "성능 데이터 CSV 파일이 비어 있습니다."
        );
      }

      // CSV 파싱
      const rows = parseCSV(text);

      if (!rows.length) {
        throw new Error(
          "성능 데이터 CSV를 읽을 수 없습니다."
        );
      }

      // 첫 번째 행 = 헤더
      const headers = rows[0];

      // 나머지 = 데이터
      const bodyRows = rows.slice(1);

      // ==========================================
      // React State 저장
      // ==========================================
      setPerformanceData({
        headers,
        rows: bodyRows,
      });
    } catch (err) {
      console.error(err);

      setPerformanceError(
        err.message ||
          "모델 성능 데이터를 불러오지 못했습니다."
      );
    } finally {
      setPerformanceLoading(false);
    }
  };

  // ==========================================
  // 모델 성능 모달 닫기
  // ==========================================
  const handleClosePerformanceModal = () => {
    setIsPerformanceModalOpen(false);
  };

  // ==========================================
  // ESC 키로 모달 닫기
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        isPerformanceModalOpen
      ) {
        setIsPerformanceModalOpen(false);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [isPerformanceModalOpen]);

  return (
    <div className="app-container">

      {/* ==========================================
          좌측 사이드바
          ========================================== */}
      <aside className="sidebar">

        <div className="sidebar-top">

          {/* 로고 */}
          <div className="sidebar-header">
            <span>📦</span>
            SmartOrder
          </div>

          {/* 메뉴 */}
          <nav className="sidebar-nav">

            {[
              {
                name: "대시보드",
                icon: "📊",
              },
              {
                name: "품절 위험",
                icon: "⚠️",
              },
              {
                name: "재고 현황",
                icon: "📦",
              },
              {
                name: "수요 분석",
                icon: "📈",
              },
              {
                name: "발주 관리",
                icon: "📋",
              },
            ].map((menu) => (
              <button
                key={menu.name}
                onClick={() =>
                  setActiveMenu(menu.name)
                }
                className={`nav-item ${
                  activeMenu === menu.name
                    ? "active"
                    : ""
                }`}
              >
                <span>{menu.icon}</span>
                {menu.name}
              </button>
            ))}

          </nav>

        </div>

        {/* ==========================================
            사이드바 하단
            ========================================== */}
        <div className="sidebar-footer">

          <div className="mart-select-label">
            마트 선택
          </div>

          <div className="mart-buttons">

            {/* A마트 */}
            <button
              type="button"
              onClick={() =>
                setMartType("A마트")
              }
              className={`mart-btn ${
                martType === "A마트"
                  ? "active"
                  : ""
              }`}
            >
              A마트
            </button>

            {/* B마트 */}
            <button
              type="button"
              onClick={() =>
                setMartType("B마트")
              }
              className={`mart-btn ${
                martType === "B마트"
                  ? "active"
                  : ""
              }`}
            >
              B마트
            </button>

          </div>

          {/* ==========================================
              모델 성능 보기
              ========================================== */}
          <button
            type="button"
            className="model-perf-btn"
            onClick={handleModelPerformance}
          >
            <span>
              ⚙️ 모델 성능 보기
            </span>

            <span>›</span>
          </button>

        </div>

      </aside>

      {/* ==========================================
          우측 메인 콘텐츠
          ========================================== */}
      <main className="main-content">

        {/* ==========================================
            로딩
            ========================================== */}
        {loading && (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
            }}
          >
            데이터를 불러오는 중입니다...
          </div>
        )}

        {/* ==========================================
            에러
            ========================================== */}
        {error && (
          <div
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              color: "#ff6b6b",
            }}
          >
            {error}
          </div>
        )}

        {/* ==========================================
            페이지
            ========================================== */}
        {!loading && !error && (
          <>
            {/* 대시보드 */}
            {activeMenu === "대시보드" && (
              <Dashboard
                martType={martType}
                data={data}
              />
            )}

            {/* 품절 위험 */}
            {activeMenu === "품절 위험" && (
              <StockRiskPage
                martType={martType}
                data={data}
              />
            )}

            {/* 재고 현황 */}
            {activeMenu === "재고 현황" && (
              <InventoryStatusPage
                martType={martType}
                data={data}
              />
            )}

            {/* 수요 분석 */}
            {activeMenu === "수요 분석" && (
              <DemandAnalysisPage
                martType={martType}
                data={data}
              />
            )}

            {/* 발주 관리 */}
            {activeMenu === "발주 관리" && (
              <PurchaseManagementPage
                martType={martType}
                data={data}
              />
            )}
          </>
        )}

      </main>

      {/* ==================================================
          모델 성능 모달
          ================================================== */}
      {isPerformanceModalOpen && (
        <div
          className="performance-modal-overlay"
          onClick={handleClosePerformanceModal}
        >

          <div
            className="performance-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ==========================================
                모달 헤더
                ========================================== */}
            <div className="performance-modal-header">

              <div className="performance-modal-title-area">

                <div className="performance-modal-brand">
                  SmartOrder · {martType}
                </div>

                <h2>
                  {martType} 모델 성능
                </h2>

                <p>
                  현재 선택된 {martType}
                  모델 성능 데이터
                </p>

              </div>

              {/* 닫기 버튼 */}
              <button
                type="button"
                className="performance-modal-close"
                onClick={
                  handleClosePerformanceModal
                }
                aria-label="모달 닫기"
              >
                ×
              </button>

            </div>

            {/* ==========================================
                모달 본문
                ========================================== */}
            <div className="performance-modal-body">

              {/* 로딩 */}
              {performanceLoading && (
                <div className="performance-modal-loading">

                  <div className="performance-loading-spinner">
                    <div></div>
                  </div>

                  <div>
                    {martType}
                    모델 성능 데이터를
                    불러오는 중입니다...
                  </div>

                </div>
              )}

              {/* 에러 */}
              {!performanceLoading &&
                performanceError && (
                  <div className="performance-modal-error">

                    <div className="performance-error-icon">
                      ⚠️
                    </div>

                    <h3>
                      데이터를 불러오지 못했습니다.
                    </h3>

                    <p>
                      {performanceError}
                    </p>

                  </div>
                )}

              {/* 정상 데이터 */}
              {!performanceLoading &&
                !performanceError &&
                performanceData.headers.length > 0 && (
                  <>

                    {/* 데이터 개수 */}
                    <div className="performance-data-count">
                      총{" "}
                      {performanceData.rows.length.toLocaleString()}
                      개 행
                    </div>

                    {/* 테이블 */}
                    <div className="performance-table-container">

                      <table className="performance-table">

                        <thead>
                          <tr>
                            {performanceData.headers.map(
                              (
                                header,
                                index
                              ) => (
                                <th
                                  key={index}
                                >
                                  {header}
                                </th>
                              )
                            )}
                          </tr>
                        </thead>

                        <tbody>

                          {performanceData.rows.map(
                            (
                              row,
                              rowIndex
                            ) => (
                              <tr
                                key={
                                  rowIndex
                                }
                              >

                                {performanceData.headers.map(
                                  (
                                    _,
                                    columnIndex
                                  ) => (
                                    <td
                                      key={
                                        columnIndex
                                      }
                                    >
                                      {
                                        row[
                                          columnIndex
                                        ] ??
                                        ""
                                      }
                                    </td>
                                  )
                                )}

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </>
                )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}