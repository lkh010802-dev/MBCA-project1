import React, { useState, useMemo } from "react";
import Badge from "../components/common/Badge"; 
import { getProductName, getStoreName, getCategoryName } from "../utils/formatters";
import "./styles/InventoryStatusPage.css";
export default function InventoryStatusPage({
  data = [],
  martType = "A마트",
}) {
  const rows = data || [];

  // 1. 유효한 날짜 목록 추출 (오름차순 또는 내림차순 정렬)
  const availableDates = useMemo(() => {
    const dates = [...new Set(rows.map(r => r.date))].filter(Boolean);
    return dates.sort();
  }, [rows]);

  // 기본 기준일: 데이터의 가장 마지막 날짜(가장 최신) 또는 첫번째 날짜 선택
  const defaultDate = availableDates.length > 0 ? availableDates[availableDates.length - 1] : "2025-05-27";

  // 상태 관리
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [filterType, setFilterType] = useState("all");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 2. 선택된 '기준일'에 해당하는 데이터만 먼저 스냅샷으로 필터링 (현업 관점의 핵심)
  const snapshotRows = useMemo(() => {
    return rows.filter(r => r.date === selectedDate);
  }, [rows, selectedDate]);

  // 3. 상단 요약 지표 계산 (선택된 기준일 스냅샷 기준)
  const shortageRows = snapshotRows.filter(r => r.stock_level_start <= r.reorder_point_90 || r.reorder_flag_90 === 1);
  const excessRows = snapshotRows.filter(r => r.stock_level_start > r.recommended_stock_90);
  const optimalRows = snapshotRows.filter(r => !shortageRows.includes(r) && !excessRows.includes(r));
  
  const optimalRatio = snapshotRows.length > 0 ? ((optimalRows.length / snapshotRows.length) * 100).toFixed(1) : "0.0";

  // 4. 메인 테이블 리스트 필터링 (매장, 카테고리, 상태)
  const filteredRows = snapshotRows.filter((row) => {
    if (filterType === "shortage" && !shortageRows.includes(row)) return false;
    if (filterType === "optimal" && !optimalRows.includes(row)) return false;
    if (filterType === "excess" && !excessRows.includes(row)) return false;

    if (selectedStore !== "all" && String(row.store_id) !== String(selectedStore)) return false;
    if (selectedCategory !== "all" && String(row.category) !== String(selectedCategory)) return false;

    return true;
  });

  const handleFilterChange = (type) => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  // 5. 우측 사이드바 데이터 가공 (선택 기준일 기준 매장별 분포)
  const storeIds = [...new Set(snapshotRows.map(r => r.store_id))];
  const storeDistributions = storeIds.map(storeId => {
    const storeData = snapshotRows.filter(r => r.store_id === storeId);
    const totalCount = storeData.length;
    const shortCount = storeData.filter(r => r.stock_level_start <= r.reorder_point_90 || r.reorder_flag_90 === 1).length;
    const excessCount = storeData.filter(r => r.stock_level_start > r.recommended_stock_90).length;
    const optCount = totalCount - shortCount - excessCount;

    return {
      storeId,
      storeName: getStoreName(storeId),
      totalStockSum: storeData.reduce((acc, cur) => acc + (cur.stock_level_start || 0), 0),
      shortPct: totalCount ? (shortCount / totalCount) * 100 : 0,
      optPct: totalCount ? (optCount / totalCount) * 100 : 0,
      excessPct: totalCount ? (excessCount / totalCount) * 100 : 0,
    };
  });

  // 과잉재고 TOP 6 추출 (기준일 기준 - 소수점 제외 반올림 정수 처리)
  const topExcessItems = [...snapshotRows]
    .map(r => ({
      ...r,
      excessAmount: Math.round(Math.max(0, (r.stock_level_start || 0) - (r.recommended_stock_90 || 0)))
    }))
    .sort((a, b) => b.excessAmount - a.excessAmount)
    .slice(0, 6);

  return (
    <div className="inventory-status-page">
      
      {/* 0. 페이지 헤더 및 기준일 변경 컨트롤 */}
      <div className="page-header-row">
        <div>
          <span className="breadcrumb">
            SmartOrder · {martType}
          </span>
          <h2>재고 현황 대시보드</h2>
          <p>특정 기준일 시점의 매장별 재고 상태를 진단하고 적정/과잉/부족 여부를 관리합니다.</p>
        </div>
        <div className="header-actions">
          <div className="filter-group date-picker-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#333' }}>기준일자:</label>
            <select 
              value={selectedDate} 
              onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ddd', fontWeight: 'bold', color: '#1890ff' }}
            >
              {availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>
          <button className="btn-balance" onClick={() => alert("재고 균형 최적화 시뮬레이션을 실행합니다.")}>
            재고 균형 최적화
          </button>
        </div>
      </div>

      {/* 1. 상단 요약 지표 카드 영역 (선택된 기준일 스냅샷 기준) */}
      <div className="summary-cards-grid">
        <div className="summary-card shortage" onClick={() => handleFilterChange("shortage")} style={{ cursor: "pointer" }}>
          <span className="card-title">발주 필요</span>
          <strong className="card-value text-danger">{shortageRows.length}건</strong>
          <span className="card-desc">즉시 발주 대상 상품</span>
        </div>
        <div className="summary-card optimal" onClick={() => handleFilterChange("optimal")} style={{ cursor: "pointer" }}>
          <span className="card-title">적정 재고</span>
          <strong className="card-value text-success">{optimalRows.length}건</strong>
          <span className="card-desc">권장 범위 내 상품</span>
        </div>
        <div className="summary-card excess" onClick={() => handleFilterChange("excess")} style={{ cursor: "pointer" }}>
          <span className="card-title">과잉 재고</span>
          <strong className="card-value text-warning">{excessRows.length}건</strong>
          <span className="card-desc">초과 재고 상품</span>
        </div>
        <div className="summary-card ratio">
          <span className="card-title">재고 적정 비율</span>
          <strong className="card-value text-primary">{optimalRatio}%</strong>
          <span className="card-desc">기준일 전체 상품 대비</span>
        </div>
      </div>

      {/* 2. 드롭다운 필터 바 */}
      <div className="filter-dropdown-bar">
        <div className="filter-group">
          <label>매장</label>
          <select value={selectedStore} onChange={(e) => { setSelectedStore(e.target.value); setCurrentPage(1); }}>
            <option value="all">전체 매장</option>
            {storeIds.map(id => (
              <option key={id} value={id}>{getStoreName(id)} ({id})</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>카테고리</label>
          <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}>
            <option value="all">전체 카테고리</option>
            <option value="Electronics">Electronics (가전)</option>
            <option value="Grocery">Grocery (식료품)</option>
            <option value="Apparel">Apparel (의류)</option>
            <option value="Home">Home (홈/리빙)</option>
          </select>
        </div>
        <div className="filter-group">
          <label>재고 상태</label>
          <select value={filterType} onChange={(e) => handleFilterChange(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="shortage">발주 필요 (부족)</option>
            <option value="optimal">적정 재고</option>
            <option value="excess">과잉 재고</option>
          </select>
        </div>
      </div>

      {/* 3. 메인 콘텐츠 및 우측 사이드바 레이아웃 */}
      <div className="main-layout-grid">
        
        {/* 왼쪽: 메인 테이블 */}
        <section className="panel full-width">
          <div className="panel-title-wrap">
            <div>
              <h3>현재 재고 vs 권장재고 ({selectedDate})</h3>
              <p className="panel-desc">막대 길이는 상품별 두 재고 중 큰 값을 기준으로 표시합니다.</p>
            </div>
            <span className="item-count">조회 결과: {filteredRows.length}건</span>
          </div>

          <div className="inventory-table-header">
            <span>상품</span>
            <span>매장</span>
            <span>재고 상태</span>
            <span>현재 재고</span>
            <span>권장 재고</span>
            <span>재고 비교</span>
            <span>관리 조치</span>
          </div>

          <div className="inventory-list">
            {currentRows.length === 0 && (
              <div className="empty">조건에 해당하는 재고 상품이 없습니다.</div>
            )}

            {currentRows.map((row, index) => {
              const currentStock = Math.round(row.stock_level_start || 0);
              const recommendedStock = Math.round(row.recommended_stock_90 || 1000);
              const maxVal = Math.max(currentStock, recommendedStock, 1);
              
              const currentWidth = (currentStock / maxVal) * 100;
              const recommendedWidth = (recommendedStock / maxVal) * 100;

              let badgeType = "success";
              let badgeText = "적정";
              let actionText = "상세 관리";
              
              if (row.stock_level_start <= row.reorder_point_90 || row.reorder_flag_90 === 1) {
                badgeType = "danger";
                badgeText = "발주 필요";
                actionText = "긴급 발주";
              } else if (row.stock_level_start > row.recommended_stock_90) {
                badgeType = "warning";
                badgeText = "과잉 재고";
                actionText = "재고 조정";
              }

              return (
                <div className="inventory-row-grid" key={`${row.date}-${row.store_id}-${row.product_id || index}`}>
                  <div>
                    <strong>{getProductName(row.product_id)}</strong>
                    <div className="sub-code">{row.product_id} · {getCategoryName(row.category)}</div>
                  </div>
                  <div>{getStoreName(row.store_id)}</div>
                  <div><Badge type={badgeType}>{badgeText}</Badge></div>
                  <div>{currentStock.toLocaleString()}개</div>
                  <div>{recommendedStock.toLocaleString()}개</div>
                  
                  <div className="bar-chart-container">
                    <div className="bar current" style={{ width: `${Math.min(currentWidth, 100)}%` }} title={`현재: ${currentStock}`}></div>
                    <div className="bar recommended" style={{ width: `${Math.min(recommendedWidth, 100)}%` }} title={`권장: ${recommendedStock}`}></div>
                  </div>

                  <div>
                    <button 
                      className="action-btn"
                      onClick={() => alert(`[${getProductName(row.product_id)}] ${actionText} 모달창을 엽니다.`)}
                    >
                      {actionText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="inventory-pagination">
              <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>&lt;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button className="pagination-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>&gt;</button>
            </div>
          )}
        </section>

        {/* 오른쪽: 사이드 위젯 영역 */}
        <aside className="side-widgets">
          
          <div className="widget-card">
            <h4>매장별 재고 분포</h4>
            <p className="widget-desc">{selectedDate} 기준 구성 비율</p>
            
            <div className="distribution-list">
              {storeDistributions.map((store) => (
                <div key={store.storeId}>
                  <div className="dist-info">
                    <span>{store.storeName} ({store.storeId})</span>
                    <span>{Math.round(store.totalStockSum).toLocaleString()}개</span>
                  </div>
                  <div className="dist-bar-bg">
                    <div className="dist-segment short" style={{ width: `${store.shortPct}%` }} title="발주 필요"></div>
                    <div className="dist-segment optimal" style={{ width: `${store.optPct}%` }} title="적정"></div>
                    <div className="dist-segment excess" style={{ width: `${store.excessPct}%` }} title="과잉"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="widget-card">
            <h4>과잉재고 TOP 6</h4>
            <p className="widget-desc">권장재고 초과 수량 기준</p>
            
            <div className="top-excess-list">
              {topExcessItems.length === 0 ? (
                <div className="empty" style={{ fontSize: '12px' }}>과잉 재고 상품이 없습니다.</div>
              ) : (
                topExcessItems.map((item, idx) => (
                  <div className="top-item" key={idx}>
                    <span>{getProductName(item.product_id)}</span>
                    <span className="excess-val">+{item.excessAmount.toLocaleString()}개</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}