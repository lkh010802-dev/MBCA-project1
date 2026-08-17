import { useEffect, useMemo, useState } from 'react'
import './App.css'
import bmartRealData from './data/bmartRealData.json'
import bmartAnalysisData from './data/bmartAnalysisData.json'
import bmartReceiptData from './data/bmartReceiptData.json'
import { inventoryByStore as aInventoryByStore, modelMetrics, products, summaryByMart } from './data/mockData'

// 왼쪽 사이드바에 표시할 메뉴 목록입니다.
const menu = [
  ['dashboard', '⌂', '대시보드'],
  ['risk', '!', '품절 위험'],
  ['inventory', '◇', '재고 현황'],
  ['analysis', '⌁', '수요 분석'],
  ['orders', '▤', '발주 관리'],
]

// 수량과 금액을 한국식 천 단위 구분으로 보여줍니다.
const number = (value) => new Intl.NumberFormat('ko-KR').format(value)

// A마트 목업과 B마트 실제 서비스 결과를 하나의 상품 목록으로 합칩니다.
const dashboardProducts = [...products.filter((item) => item.mart === 'A'), ...bmartRealData.products]
const summaryDataByMart = { A: summaryByMart.A, B: bmartRealData.summary }
const inventoryDataByMart = { A: aInventoryByStore, B: bmartRealData.inventoryByStore }

// A마트는 원화, B마트 원본 가격은 달러 단위로 표시합니다.
const formatCurrency = (value, mart) => mart === 'B'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  : `${number(Math.round(value))}원`

const shortageOf = (item) => item.shortage ?? Math.max(item.demand + item.safety - item.stock, 0)

function RiskBadge({ risk }) {
  return <span className={`risk-badge risk-${risk}`}>{risk}</span>
}

function MiniLineChart({ actual, forecast }) {
  const width = 360
  const height = 180
  const padding = { top: 12, right: 12, bottom: 34, left: 42 }
  const all = [...actual, ...forecast]
  const min = Math.floor((Math.min(...all) - 10) / 10) * 10
  const max = Math.ceil((Math.max(...all) + 10) / 10) * 10
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const yTicks = [max, Math.round((max + min) / 2), min]
  const xTicks = [
    { index: 0, label: 'D-11' },
    { index: 5, label: 'D-6' },
    { index: actual.length - 1, label: '오늘' },
  ]

  // 실제값과 예측값을 SVG 좌표로 변환합니다.
  const points = (values) => values.map((value, index) => {
    const x = padding.left + (index * plotWidth) / (values.length - 1)
    const y = padding.top + ((max - value) / (max - min)) * plotHeight
    return `${x},${y}`
  }).join(' ')

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="최근 12일 실제 수요와 예측 수요 비교">
      <title>가로축은 최근 12일, 세로축은 일별 수요량(개)입니다.</title>
      {yTicks.map((tick) => {
        const y = padding.top + ((max - tick) / (max - min)) * plotHeight
        return <g key={tick}><line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="chart-grid" /><text x={padding.left - 7} y={y + 3} textAnchor="end" className="chart-tick">{tick}</text></g>
      })}
      {xTicks.map(({ index, label }) => {
        const x = padding.left + (index * plotWidth) / (actual.length - 1)
        return <text key={label} x={x} y={height - 17} textAnchor={index === 0 ? 'start' : index === actual.length - 1 ? 'end' : 'middle'} className="chart-tick">{label}</text>
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="chart-axis" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="chart-axis" />
      <polyline points={points(actual)} className="actual-line" />
      <polyline points={points(forecast)} className="forecast-line" />
      <text x="12" y={padding.top + plotHeight / 2} textAnchor="middle" className="chart-axis-title" transform={`rotate(-90 12 ${padding.top + plotHeight / 2})`}>수요량(개)</text>
      <text x={padding.left + plotWidth / 2} y={height - 2} textAnchor="middle" className="chart-axis-title">최근 12일</text>
    </svg>
  )
}

function Sidebar({ active, setActive, mart, setMart, onOpenModel }) {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">▦</span><span>SmartOrder</span></div>
      <nav>
        {menu.map(([key, icon, label]) => (
          <button key={key} className={active === key ? 'nav-item active' : 'nav-item'} onClick={() => setActive(key)}>
            <span className="nav-icon">{icon}</span>{label}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <p>마트 선택</p>
        <div className="mart-switch">
          {['A', 'B'].map((item) => <button key={item} className={mart === item ? 'selected' : ''} onClick={() => setMart(item)}>{item}마트</button>)}
        </div>
        <button className="model-link" onClick={onOpenModel}>▥ 모델 성능 보기 <span>›</span></button>
      </div>
    </aside>
  )
}

function SummaryCards({ summary }) {
  // 요약 데이터 한 건을 카드 한 장으로 바꾸기 위한 표시 설정입니다.
  const cards = [
    ['오늘의 예측 수요', number(summary.demand), '개', '↗', summary.demandTrend ?? '전일 대비 +8.3%', 'purple'],
    ['긴급 발주 필요 상품 수', number(summary.urgent), '개', '!', summary.urgentTrend ?? '전일 대비 +5개', 'red'],
    ['권장 발주 총량', number(summary.orderQty), '개', '◇', summary.orderTrend ?? '전일 대비 +12.5%', 'blue'],
    ['적정 재고 비율', summary.healthyRate, '%', '◔', summary.healthyTrend ?? '전일 대비 +4.2%p', 'green'],
  ]
  return <section className="summary-grid">{cards.map(([label, value, unit, icon, trend, color]) => (
    <article className="summary-card" key={label}>
      <div className={`summary-icon ${color}`}>{icon}</div>
      <div><p>{label}</p><strong>{value}<small>{unit}</small></strong><span>{trend}</span></div>
    </article>
  ))}</section>
}

function Dashboard({ mart, store, setStore, rows, selected, setSelected, quantities, setQuantities, approvals, approveAll }) {
  // 품절 위험 카드에서 현재 선택한 등급을 기억합니다.
  const [riskFilter, setRiskFilter] = useState('전체')
  const summary = summaryDataByMart[mart]
  const stores = ['전체 매장', ...new Set(dashboardProducts.filter((p) => p.mart === mart).map((p) => p.store))]
  const filteredRiskRows = riskFilter === '전체' ? rows : rows.filter((item) => item.risk === riskFilter)

  // 현재 필터에 맞춰 부족 수량, 총 발주량, 총 발주 금액을 다시 계산합니다.
  const shortage = rows.reduce((sum, item) => sum + shortageOf(item), 0)
  const totalOrder = rows.reduce((sum, item) => sum + (quantities[item.id] ?? item.orderQty), 0)
  const totalAmount = rows.reduce((sum, item) => sum + (quantities[item.id] ?? item.orderQty) * item.price, 0)
  const inventorySummary = mart === 'B'
    ? {
        shortage,
        healthy: rows.filter((item) => item.inventoryStatus === '적정 재고').reduce((sum, item) => sum + item.stock, 0),
        excess: rows.reduce((sum, item) => sum + (item.excess ?? 0), 0),
      }
    : { shortage, healthy: 245, excess: 61 }
  const storeInventory = inventoryDataByMart[mart].filter((item) => store === '전체 매장' || item.store === store)
  const inventoryScaleMax = Math.max(...storeInventory.map((item) => Math.sqrt(item.shortage) + Math.sqrt(item.healthy) + Math.sqrt(item.excess)), 1)

  // 발주 수량은 0보다 작아지지 않도록 보호합니다.
  const updateQty = (id, delta) => setQuantities((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? dashboardProducts.find((p) => p.id === id).orderQty) + delta) }))

  return (
    <>
      <header className="page-header"><div><h1>대시보드</h1><span>{summary.asOfLabel ?? '2026.08.14 (금)'}</span>{mart === 'B' && <em className="real-data-badge">실데이터</em>}</div><div className="header-actions"><select value={store} onChange={(e) => setStore(e.target.value)}>{stores.map((s) => <option key={s}>{s}</option>)}</select><button className="refresh" aria-label="새로고침">↻</button></div></header>
      <SummaryCards summary={summary} />
      <section className="dashboard-grid">
        <div className="main-column">
          <div className="two-column">
            <article className="panel priority-panel">
              <div className="panel-header"><h2>발주 우선순위 TOP 5</h2><button>전체 보기 ›</button></div>
              <div className="table-scroll"><table><thead><tr><th>순위</th><th>상품명</th><th>매장</th><th>긴급도</th><th>예상 부족</th><th>예상 품절일</th></tr></thead><tbody>{rows.slice(0, 5).map((item, index) => <tr key={item.id} className={selected.id === item.id ? 'selected-row' : ''} onClick={() => setSelected(item)}><td>{index + 1}</td><td><b>{item.label}</b><small>{item.product}</small></td><td>{item.store}</td><td><RiskBadge risk={item.risk} /></td><td>{shortageOf(item)}</td><td>{item.stockoutDate}</td></tr>)}</tbody></table></div>
            </article>
            <article className="panel reason-panel">
              <div className="panel-header"><h2>상품별 발주 필요 근거</h2><span className="model-chip">{mart === 'B' ? bmartRealData.model.name : 'XGBoost'}</span></div>
              <div className="reason-content">
                <div className="reason-copy"><h3>{selected.label} <span>({selected.store})</span></h3><div className="forecast-tags"><span>예상 품절일: {selected.stockoutDate}</span><span>예상 부족 수량: {shortageOf(selected)}개</span></div><ul><li>최근 수요 추세와 프로모션 효과 반영</li><li>{mart === 'B' ? `P95 목표재고 ${selected.targetStock}개 적용` : `안전재고 ${selected.safety}개 포함`}</li><li>{selected.managementAction ?? `최근 결품 빈도 ${selected.frequency}`}</li></ul></div>
                <div className="chart-area"><div className="chart-legend"><span className="legend-actual">실제 수요</span><span className="legend-forecast">예측 수요</span></div><MiniLineChart actual={selected.currentSales} forecast={selected.forecast} /></div>
              </div>
            </article>
          </div>
          <article className="panel order-panel">
            <div className="panel-header"><h2>권장 발주안 확인 및 조정</h2><span>모델 권장값을 담당자가 최종 조정합니다.</span></div>
            <div className="order-layout"><div className="table-scroll"><table><thead><tr><th>상품명</th><th>매장</th><th>현재 재고</th><th>권장 발주</th><th>조정 수량</th><th>최종 발주</th><th>발주 금액</th><th>상태</th></tr></thead><tbody>{rows.filter((r) => r.orderQty > 0).slice(0, 4).map((item) => { const qty = quantities[item.id] ?? item.orderQty; return <tr key={item.id}><td><b>{item.label}</b></td><td>{item.store}</td><td>{item.stock}</td><td>{item.orderQty}</td><td><div className="stepper">{[-100, -10, -1].map((step) => <button key={step} onClick={() => updateQty(item.id, step)} aria-label={`${item.label} 수량 ${Math.abs(step)} 감소`}>{step}</button>)}<span>{qty}</span>{[1, 10, 100].map((step) => <button key={step} onClick={() => updateQty(item.id, step)} aria-label={`${item.label} 수량 ${step} 증가`}>+{step}</button>)}</div></td><td>{qty}</td><td>{formatCurrency(qty * item.price, mart)}</td><td className={approvals[item.id] ? 'approved' : 'waiting'}>{approvals[item.id] ? '승인 완료' : '승인 대기'}</td></tr>})}</tbody></table></div><div className="approval-summary"><p>총 발주 금액</p><strong>{formatCurrency(totalAmount, mart)}</strong><p>총 발주 수량</p><b>{number(totalOrder)}개</b><button onClick={approveAll}>발주안 승인하기</button></div></div>
          </article>
        </div>
        <aside className="right-column">
          <article className="panel risk-panel">
            <div className="panel-header"><h2>품절 위험</h2><span>{filteredRiskRows.length}개 상품</span></div>
            <div className="risk-tabs">
              {['전체', '긴급', '주의', '정상'].map((risk) => <button key={risk} className={riskFilter === risk ? 'active' : ''} aria-pressed={riskFilter === risk} onClick={() => setRiskFilter(risk)}>{risk}</button>)}
            </div>
            <div className="risk-list">
              {filteredRiskRows.slice(0, 5).map((item) => <button key={item.id} onClick={() => setSelected(item)}><span><b>{item.label}</b><small>{item.store}</small></span><RiskBadge risk={item.risk} /><em>{shortageOf(item)}개</em></button>)}
              {filteredRiskRows.length === 0 && <p className="risk-empty">해당 등급의 상품이 없습니다.</p>}
            </div>
          </article>
          <article className="panel inventory-panel"><div className="panel-header"><h2>재고 현황</h2></div><div className="inventory-stats"><div><span className="stock-dot shortage"></span><p>부족 재고<strong>{number(inventorySummary.shortage)}개</strong></p></div><div><span className="stock-dot healthy"></span><p>적정 재고<strong>{number(inventorySummary.healthy)}개</strong></p></div><div><span className="stock-dot excess"></span><p>과잉 재고<strong>{number(inventorySummary.excess)}개</strong></p></div></div></article>
          <article className="panel store-chart"><div className="panel-header"><h2>매장별 재고 상태 분포</h2></div><div className="bars">{storeInventory.map((item) => <div className="bar-group" key={item.store}><div className="bar" title={`${item.store}: 부족 ${item.shortage}, 적정 ${item.healthy}, 과잉 ${item.excess}`}><span className="bar-excess" style={{ height: `${(Math.sqrt(item.excess) / inventoryScaleMax) * 100}%` }}></span><span className="bar-healthy" style={{ height: `${(Math.sqrt(item.healthy) / inventoryScaleMax) * 100}%` }}></span><span className="bar-shortage" style={{ height: `${(Math.sqrt(item.shortage) / inventoryScaleMax) * 100}%` }}></span></div><small>{item.store}</small></div>)}</div><div className="bar-legend"><span>● 부족</span><span>● 적정</span><span>● 과잉</span></div></article>
        </aside>
      </section>
    </>
  )
}

function Gauge({ label, value, max, display, good = 'high' }) {
  // 지표별 최대값을 기준으로 게이지가 채워질 비율과 상태 색상을 정합니다.
  const ratio = Math.min(Math.max(value / max, 0), 1)
  const score = good === 'low' ? 1 - ratio : ratio
  const color = score >= 0.75 ? '#43c8bd' : score >= 0.5 ? '#ffb34d' : '#ff6b70'
  const dash = `${Math.round(ratio * 126)} 126`
  return <div className="gauge-card"><p>{label}</p><svg viewBox="0 0 120 80" role="img" aria-label={`${label} ${display}`}><path className="gauge-track" d="M20 68 A42 42 0 1 1 100 68" pathLength="126" /><path className="gauge-value" d="M20 68 A42 42 0 1 1 100 68" pathLength="126" style={{ stroke: color, strokeDasharray: dash }} /><circle cx={20 + 80 * ratio} cy={68 - 55 * Math.sin(Math.PI * ratio)} r="3.8" style={{ fill: color }} /><text x="60" y="58" textAnchor="middle">{display}</text></svg></div>
}

function ModelModal({ open, onClose, mart }) {
  if (!open) return null
  // A마트는 비교 모델 결과, B마트는 실제 롤링 검증 평균을 표시합니다.
  const aBest = modelMetrics.find((item) => item.name === 'XGBoost')
  const model = mart === 'B'
    ? bmartRealData.model
    : { name: 'XGBoost', validation: '날짜 기준 80:20', trainedThrough: '2026.08.14', r2: aBest.r2, rmse: aBest.rmse, mae: aBest.mae, confidence: 0.87 }
  const isReal = mart === 'B'
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="model-modal" role="dialog" aria-modal="true" aria-labelledby="model-modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-title"><div><span>{mart}마트 예측 모델 {isReal && '· 실데이터'}</span><h2 id="model-modal-title">모델 성능 요약</h2></div><button onClick={onClose} aria-label="닫기">×</button></div><div className="model-summary"><div><p>적용 모델</p><strong>{model.name}</strong></div><div><p>검증 방식</p><strong>{model.validation}</strong></div><div><p>검증 종료일</p><strong>{model.trainedThrough}</strong></div></div><div className="gauge-grid"><Gauge label="R² 설명력" value={model.r2} max={1} display={`${(model.r2 * 100).toFixed(1)}점`} /><Gauge label="RMSE" value={model.rmse} max={isReal ? 30 : 80} display={model.rmse.toFixed(1)} good="low" /><Gauge label="MAE" value={model.mae} max={isReal ? 20 : 50} display={model.mae.toFixed(1)} good="low" /><Gauge label="예측 신뢰도" value={model.confidence} max={1} display={`${(model.confidence * 100).toFixed(1)}점`} /></div><div className="model-note"><span>✓</span><p><strong>현재 운영 기준을 충족합니다.</strong><br />{isReal ? `P95 정책 기준 서비스 수준 ${model.serviceLevel}%, 품절률 ${model.stockoutRate}%입니다.` : '동일 테스트 구간에서 비교한 모델 중 XGBoost의 오차가 가장 낮았습니다.'}</p></div><p className="modal-footnote">{isReal ? '※ B마트 롤링 검증 3개 구간의 평균 성능과 P95 재고 정책 결과입니다.' : '※ A마트 수치는 현재 목업 데이터이며 최종 모델 결과로 교체됩니다.'}</p></section></div>
}

const average = (rows, key) => rows.length
  ? rows.reduce((sum, item) => sum + Number(typeof key === 'function' ? key(item) : item[key] ?? 0), 0) / rows.length
  : 0

const frequencyNumber = (value = '') => Number.parseInt(value, 10) || 0
const orderRiskRank = { 긴급: 0, 주의: 1, 정상: 2 }
const actualDemandOf = (item) => Number(item.actualDemand ?? item.demand ?? 0)
const categoryOf = (item) => item.categoryKo ?? item.category ?? '기타'
const regionOf = (item) => item.region ?? item.store ?? '기타'
const inventoryStatusOf = (item) => item.inventoryStatus
  ?? (shortageOf(item) > 0 ? '발주 필요' : item.stock > item.targetStock * 1.5 ? '과잉재고' : '적정 재고')
const excessOf = (item) => Number(item.excess ?? Math.max(item.stock - item.targetStock, 0))

function DetailHeader({ title, description, mart, badge }) {
  return <header className="detail-header">
    <div><p className="detail-eyebrow">SmartOrder · {mart}마트</p><h1>{title}</h1><span>{description}</span></div>
    <div className="detail-header-meta"><em>{badge}</em><small>기준일 {mart === 'B' ? bmartRealData.summary.asOf : '2026.08.14'}</small></div>
  </header>
}

function DetailMetric({ label, value, unit, note, tone = 'purple' }) {
  return <article className={`detail-metric ${tone}`}><p>{label}</p><strong>{value}<small>{unit}</small></strong><span>{note}</span></article>
}

function FilterSelect({ label, value, onChange, options }) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>
}

function DistributionBar({ label, value, max, tone, suffix = '개' }) {
  const width = max ? Math.max((value / max) * 100, value ? 4 : 0) : 0
  return <div className="distribution-row"><div><b>{label}</b><span>{number(Math.round(value))}{suffix}</span></div><div className="distribution-track"><i className={tone} style={{ width: `${width}%` }} /></div></div>
}

function RiskPage({ mart, products: martRows }) {
  const [risk, setRisk] = useState('전체')
  const [store, setStore] = useState('전체 매장')
  const [query, setQuery] = useState('')
  const stores = ['전체 매장', ...new Set(martRows.map((item) => item.store))]
  const filtered = martRows
    .filter((item) => store === '전체 매장' || item.store === store)
    .filter((item) => risk === '전체' || item.risk === risk)
    .filter((item) => `${item.label} ${item.product}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => shortageOf(b) - shortageOf(a))
  const urgent = martRows.filter((item) => item.risk === '긴급')
  const caution = martRows.filter((item) => item.risk === '주의')
  const repeatRows = [...martRows].sort((a, b) => frequencyNumber(b.frequency) - frequencyNumber(a.frequency)).slice(0, 6)
  const maxRepeat = Math.max(...repeatRows.map((item) => frequencyNumber(item.frequency)), 1)

  return <section className="content-page detail-page risk-detail-page">
    <DetailHeader title="품절 위험" description="매장·상품별 위험 신호와 예상 부족 수량을 한 화면에서 확인합니다." mart={mart} badge="위험 모니터링" />
    <section className="detail-metric-grid">
      <DetailMetric label="긴급 상품" value={urgent.length} unit="개" note="즉시 발주 검토" tone="red" />
      <DetailMetric label="주의 상품" value={caution.length} unit="개" note="재고 추이 확인" tone="amber" />
      <DetailMetric label="예상 총 부족" value={number(martRows.reduce((sum, item) => sum + shortageOf(item), 0))} unit="개" note="현재 목표재고 기준" tone="purple" />
      <DetailMetric label="반복 결품 집중 상품" value={martRows.filter((item) => frequencyNumber(item.frequency) >= 10).length} unit="개" note="최근 30일 10회 이상" tone="blue" />
    </section>
    <div className="detail-filterbar">
      <FilterSelect label="매장" value={store} onChange={setStore} options={stores} />
      <div className="segmented-filter"><span>위험 상태</span><div>{['전체', '긴급', '주의', '정상'].map((item) => <button key={item} className={risk === item ? 'active' : ''} onClick={() => setRisk(item)}>{item}</button>)}</div></div>
      <label className="filter-field search-field"><span>상품 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상품명 또는 상품 ID" /></label>
    </div>
    <section className="detail-layout risk-detail-layout">
      <article className="panel detail-table-panel">
        <div className="panel-header"><div><h2>상품별 품절 위험</h2><p>{filtered.length}개 상품이 조회되었습니다.</p></div><span>부족 수량순</span></div>
        <div className="table-scroll"><table className="detail-table"><thead><tr><th>상품</th><th>매장</th><th>상태</th><th>현재 재고</th><th>권장 재고</th><th>예상 부족</th><th>예상 품절일</th><th>최근 결품</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><b>{item.label}</b><small>{item.product} · {categoryOf(item)}</small></td><td>{item.store}</td><td><RiskBadge risk={item.risk} /></td><td>{number(item.stock)}</td><td>{number(item.targetStock)}</td><td className="negative-value">{number(shortageOf(item))}</td><td>{item.stockoutDate}</td><td>{item.frequency}</td></tr>)}</tbody></table></div>
        {filtered.length === 0 && <div className="detail-empty">조건에 맞는 상품이 없습니다.</div>}
      </article>
      <aside className="detail-side-stack">
        <article className="panel compact-panel"><div className="panel-header"><div><h2>위험 상태 분포</h2><p>전체 상품 기준</p></div></div><div className="status-donut-wrap"><div className="status-donut" style={{ '--urgent': `${martRows.length ? (urgent.length / martRows.length) * 100 : 0}%`, '--caution': `${martRows.length ? ((urgent.length + caution.length) / martRows.length) * 100 : 0}%` }}><strong>{martRows.length}</strong><span>전체 상품</span></div><div className="donut-legend"><span><i className="dot red" />긴급 <b>{urgent.length}</b></span><span><i className="dot amber" />주의 <b>{caution.length}</b></span><span><i className="dot green" />정상 <b>{martRows.length - urgent.length - caution.length}</b></span></div></div></article>
        <article className="panel compact-panel"><div className="panel-header"><div><h2>반복 결품 TOP 6</h2><p>최근 30일 발생 빈도</p></div></div><div className="distribution-list">{repeatRows.map((item) => <DistributionBar key={item.id} label={item.label} value={frequencyNumber(item.frequency)} max={maxRepeat} tone="red" suffix="회" />)}</div></article>
      </aside>
    </section>
  </section>
}

function InventoryPage({ mart, products: martRows }) {
  const [store, setStore] = useState('전체 매장')
  const [category, setCategory] = useState('전체 카테고리')
  const [status, setStatus] = useState('전체 상태')
  const stores = ['전체 매장', ...new Set(martRows.map((item) => item.store))]
  const categories = ['전체 카테고리', ...new Set(martRows.map(categoryOf))]
  const statuses = ['전체 상태', '발주 필요', '적정 재고', '과잉재고']
  const filtered = martRows
    .filter((item) => store === '전체 매장' || item.store === store)
    .filter((item) => category === '전체 카테고리' || categoryOf(item) === category)
    .filter((item) => status === '전체 상태' || inventoryStatusOf(item) === status)
  const shortageRows = martRows.filter((item) => inventoryStatusOf(item) === '발주 필요')
  const healthyRows = martRows.filter((item) => inventoryStatusOf(item) === '적정 재고')
  const excessRows = martRows.filter((item) => inventoryStatusOf(item) === '과잉재고')
  const topExcess = [...excessRows].sort((a, b) => excessOf(b) - excessOf(a)).slice(0, 6)
  const maxExcess = Math.max(...topExcess.map(excessOf), 1)
  const storeRows = inventoryDataByMart[mart]
  const maxStoreInventory = Math.max(...storeRows.map((item) => item.shortage + item.healthy + item.excess), 1)

  return <section className="content-page detail-page inventory-detail-page">
    <DetailHeader title="재고 현황" description="현재 재고와 모델 권장재고를 비교해 부족·적정·과잉 상태를 관리합니다." mart={mart} badge="재고 균형" />
    <section className="detail-metric-grid">
      <DetailMetric label="발주 필요" value={shortageRows.length} unit="개" note={`부족 ${number(shortageRows.reduce((sum, item) => sum + shortageOf(item), 0))}개`} tone="red" />
      <DetailMetric label="적정 재고" value={healthyRows.length} unit="개" note="권장 범위 내 상품" tone="green" />
      <DetailMetric label="과잉 재고" value={excessRows.length} unit="개" note={`초과 ${number(excessRows.reduce((sum, item) => sum + excessOf(item), 0))}개`} tone="amber" />
      <DetailMetric label="재고 적정 비율" value={martRows.length ? ((healthyRows.length / martRows.length) * 100).toFixed(1) : 0} unit="%" note="전체 상품 기준" tone="purple" />
    </section>
    <div className="detail-filterbar three-filters"><FilterSelect label="매장" value={store} onChange={setStore} options={stores} /><FilterSelect label="카테고리" value={category} onChange={setCategory} options={categories} /><FilterSelect label="재고 상태" value={status} onChange={setStatus} options={statuses} /></div>
    <section className="detail-layout inventory-detail-layout">
      <article className="panel detail-table-panel">
        <div className="panel-header"><div><h2>현재 재고 vs 권장재고</h2><p>막대 길이는 상품별 두 재고 중 큰 값을 기준으로 표시합니다.</p></div><span>{filtered.length}개 상품</span></div>
        <div className="table-scroll"><table className="detail-table inventory-compare-table"><thead><tr><th>상품</th><th>매장</th><th>재고 상태</th><th>현재 재고</th><th>권장 재고</th><th>재고 비교</th><th>관리 조치</th></tr></thead><tbody>{filtered.map((item) => { const scale = Math.max(item.stock, item.targetStock, 1); const itemStatus = inventoryStatusOf(item); return <tr key={item.id}><td><b>{item.label}</b><small>{item.product} · {categoryOf(item)}</small></td><td>{item.store}</td><td><span className={`inventory-status status-${itemStatus.replaceAll(' ', '-')}`}>{itemStatus}</span></td><td>{number(item.stock)}</td><td>{number(item.targetStock)}</td><td><div className="compare-bars"><span><i style={{ width: `${(item.stock / scale) * 100}%` }} />현재</span><span><i style={{ width: `${(item.targetStock / scale) * 100}%` }} />권장</span></div></td><td>{item.managementAction ?? (itemStatus === '발주 필요' ? '발주 검토' : itemStatus === '과잉재고' ? '과잉 관리' : '정상 유지')}</td></tr>})}</tbody></table></div>
      </article>
      <aside className="detail-side-stack">
        <article className="panel compact-panel"><div className="panel-header"><div><h2>매장별 재고 분포</h2><p>부족·적정·과잉 수량 구성</p></div></div><div className="stacked-store-list">{storeRows.map((item) => { const total = item.shortage + item.healthy + item.excess; return <div key={item.store}><div><b>{item.store}</b><span>{number(total)}개</span></div><div className="stacked-track" title={`부족 ${item.shortage} · 적정 ${item.healthy} · 과잉 ${item.excess}`}><i className="shortage" style={{ width: `${(item.shortage / maxStoreInventory) * 100}%` }} /><i className="healthy" style={{ width: `${(item.healthy / maxStoreInventory) * 100}%` }} /><i className="excess" style={{ width: `${(item.excess / maxStoreInventory) * 100}%` }} /></div></div>})}</div><div className="inline-legend"><span><i className="dot red" />부족</span><span><i className="dot green" />적정</span><span><i className="dot amber" />과잉</span></div></article>
        <article className="panel compact-panel"><div className="panel-header"><div><h2>과잉재고 TOP 6</h2><p>권장재고 초과 수량</p></div></div><div className="distribution-list">{topExcess.map((item) => <DistributionBar key={item.id} label={item.label} value={excessOf(item)} max={maxExcess} tone="amber" />)}</div></article>
      </aside>
    </section>
  </section>
}

function DemandAnalysisPage({ mart, products: martRows }) {
  const snapshotPromotionGroups = [
    { label: '프로모션 적용', rows: martRows.filter((item) => item.promotion) },
    { label: '프로모션 미적용', rows: martRows.filter((item) => !item.promotion) },
  ].map((group) => ({ ...group, value: average(group.rows, actualDemandOf) }))
  const snapshotDiscountGroups = ['0%', '1~5%', '6~10%', '11% 이상'].map((label, index) => {
    const rows = martRows.filter((item) => { const discount = Number(item.discountPct ?? 0); return index === 0 ? discount === 0 : index === 1 ? discount <= 5 && discount > 0 : index === 2 ? discount <= 10 && discount > 5 : discount > 10 })
    return { label, value: average(rows, actualDemandOf), count: rows.length }
  })
  const snapshotRegionGroups = [...new Set(martRows.map(regionOf))].map((region) => {
    const rows = martRows.filter((item) => regionOf(item) === region)
    return { label: region, value: average(rows, actualDemandOf) }
  }).sort((a, b) => b.value - a.value)
  const snapshotCategoryGroups = [...new Set(martRows.map(categoryOf))].map((category) => {
    const rows = martRows.filter((item) => categoryOf(item) === category)
    return { label: category, value: average(rows, actualDemandOf) }
  }).sort((a, b) => b.value - a.value)
  const stockoutRows = martRows.filter((item) => item.risk !== '정상')
  const normalRows = martRows.filter((item) => item.risk === '정상')
  const promotionGroups = mart === 'B' ? bmartAnalysisData.promotion.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows })) : snapshotPromotionGroups
  const discountGroups = mart === 'B' ? bmartAnalysisData.discount.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows })) : snapshotDiscountGroups
  const regionGroups = mart === 'B' ? bmartAnalysisData.region.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows })) : snapshotRegionGroups
  const categoryGroups = mart === 'B' ? bmartAnalysisData.category.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows })) : snapshotCategoryGroups
  const seasonGroups = mart === 'B' ? bmartAnalysisData.season.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows })) : [{ label: '현재 시즌', value: average(martRows, actualDemandOf), count: martRows.length }]
  const relationshipGroups = mart === 'B' && bmartAnalysisData.stockoutRelationship.length
    ? bmartAnalysisData.stockoutRelationship.map((item) => ({ label: item.label, value: item.averageDemand, count: item.rows }))
    : [
        { label: '결품 위험 상품', value: average(stockoutRows, actualDemandOf), count: stockoutRows.length },
        { label: '정상 상품', value: average(normalRows, actualDemandOf), count: normalRows.length },
      ]
  const maxPromo = Math.max(...promotionGroups.map((item) => item.value), 1)
  const maxDiscount = Math.max(...discountGroups.map((item) => item.value), 1)
  const maxRegion = Math.max(...regionGroups.map((item) => item.value), 1)
  const maxCategory = Math.max(...categoryGroups.map((item) => item.value), 1)
  const maxSeason = Math.max(...seasonGroups.map((item) => item.value), 1)

  return <section className="content-page detail-page analysis-detail-page">
    <DetailHeader title="수요 분석" description="프로모션·할인·지역·재고 상태와 수요의 관계를 탐색합니다." mart={mart} badge="가설 탐색" />
    <div className="analysis-notice"><span>i</span><p><strong>해석 안내</strong> {mart === 'B' ? bmartAnalysisData.metadata.interpretation : '현재 연결된 목업 데이터의 기술통계입니다.'}</p></div>
    <div className="analysis-scroll-area">
    <section className="analysis-grid">
      <article className="panel analysis-card"><div className="panel-header"><div><h2>프로모션 여부에 따른 수요</h2><p>상품당 평균 실제 수요</p></div><span>가설 01</span></div><div className="big-bar-chart">{promotionGroups.map((item, index) => <div key={item.label}><span style={{ height: `${(item.value / maxPromo) * 100}%` }} className={index === 0 ? 'purple' : 'slate'}><b>{item.value.toFixed(1)}</b></span><small>{item.label}</small></div>)}</div><p className="analysis-caption">프로모션 적용 상품과 미적용 상품의 평균을 비교합니다.</p></article>
      <article className="panel analysis-card"><div className="panel-header"><div><h2>할인율에 따른 수요</h2><p>할인 구간별 평균 실제 수요</p></div><span>가설 02</span></div><div className="distribution-list analysis-bars">{discountGroups.map((item) => <DistributionBar key={item.label} label={`${item.label} · ${item.count}개`} value={item.value} max={maxDiscount} tone="blue" suffix="" />)}</div><p className="analysis-caption">표본 수가 작은 할인 구간은 별도 검증이 필요합니다.</p></article>
      <article className="panel analysis-card wide-analysis-card"><div className="panel-header"><div><h2>계절·지역별 수요 특성</h2><p>전체 기간 상품당 평균 수요</p></div><span>가설 03</span></div><div className="region-analysis"><div><h3>계절별</h3><div className="distribution-list">{seasonGroups.map((item) => <DistributionBar key={item.label} label={item.label} value={item.value} max={maxSeason} tone="blue" suffix="" />)}</div></div><div><h3>지역별</h3><div className="distribution-list">{regionGroups.map((item) => <DistributionBar key={item.label} label={item.label} value={item.value} max={maxRegion} tone="purple" suffix="" />)}</div></div></div></article>
      <article className="panel analysis-card"><div className="panel-header"><div><h2>결품과 이후 수요 관계</h2><p>결품 후보 다음날과 일반 관측 다음날 비교</p></div><span>가설 04</span></div><div className="relation-comparison">{relationshipGroups.map((item, index) => <div key={item.label} className={index === 0 ? 'danger' : ''}><span>{item.label}</span><strong>{item.value.toFixed(1)}</strong><small>평균 수요 · {number(item.count)}행</small></div>)}</div><p className="analysis-caption">결품 후보는 대리조건이며 연관성만 보여줍니다. 인과관계로 해석하지 않습니다.</p></article>
      <article className="panel analysis-card"><div className="panel-header"><div><h2>카테고리별 수요 특성</h2><p>상품당 평균 실제 수요</p></div><span>추가 요인</span></div><div className="distribution-list analysis-bars">{categoryGroups.slice(0, 6).map((item) => <DistributionBar key={item.label} label={item.label} value={item.value} max={maxCategory} tone="green" suffix="" />)}</div></article>
    </section>
    <article className="panel factor-panel"><div className="panel-header"><div><h2>주요 수요 요인 템플릿</h2><p>팀원이 모델 중요도 또는 SHAP 결과를 연결할 수 있는 영역입니다.</p></div><span>연결 예정</span></div><div className="factor-grid">{[
      ['01', '최근 수요 이력', 'Lag·Rolling 수요 지표'],
      ['02', '가격과 할인', '판매가격·할인율'],
      ['03', '프로모션', '행사 적용 여부'],
      ['04', '계절과 지역', '시즌·매장 권역'],
      ['05', '상품·매장 특성', '카테고리·SKU·점포'],
    ].map(([rank, title, description]) => <div key={rank}><span>{rank}</span><p><b>{title}</b><small>{description}</small></p></div>)}</div></article>
    </div>
  </section>
}

const constrainedOrderQty = (value, item) => {
  const pack = Math.max(Number(item.packSize ?? 1), 1)
  const minimum = Math.max(Number(item.minimumOrderQty ?? 0), 0)
  if (value <= 0) return 0
  return Math.max(Math.ceil(value / pack) * pack, Math.ceil(minimum / pack) * pack)
}

function OrderManagementPage({ mart, products: martRows }) {
  const receiptByProduct = mart === 'B' ? bmartReceiptData.products : {}
  const enrichedRows = martRows.map((item) => ({ ...item, receipt: receiptByProduct[item.id] }))
  const candidates = enrichedRows
    .map((item) => ({ ...item, originalOrderQty: item.orderQty, orderQty: item.receipt?.receiptAdjustedOrderQty ?? item.orderQty }))
    .filter((item) => item.orderQty > 0 || item.risk !== '정상')
  const [mode, setMode] = useState('orders')
  const [store, setStore] = useState('전체 매장')
  const [decision, setDecision] = useState('전체 상태')
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [quantities, setQuantities] = useState(() => Object.fromEntries(candidates.map((item) => [item.id, constrainedOrderQty(item.orderQty, item)])))
  const [decisions, setDecisions] = useState(() => Object.fromEntries(candidates.map((item) => [item.id, '검토 필요'])))
  const [liveOrders, setLiveOrders] = useState(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(window.localStorage.getItem('bmart-live-orders') ?? '[]') } catch { return [] }
  })
  const [auditLogs, setAuditLogs] = useState(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(window.localStorage.getItem('bmart-audit-logs') ?? '[]') } catch { return [] }
  })
  const [backupStatus, setBackupStatus] = useState('')
  useEffect(() => {
    window.localStorage.setItem('bmart-live-orders', JSON.stringify(liveOrders))
  }, [liveOrders])
  useEffect(() => {
    window.localStorage.setItem('bmart-audit-logs', JSON.stringify(auditLogs))
  }, [auditLogs])
  const stores = ['전체 매장', ...new Set(candidates.map((item) => item.store))]
  const filtered = candidates
    .filter((item) => store === '전체 매장' || item.store === store)
    .filter((item) => decision === '전체 상태' || decisions[item.id] === decision)
    .filter((item) => `${item.label} ${item.product}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (orderRiskRank[a.risk] ?? 3) - (orderRiskRank[b.risk] ?? 3) || shortageOf(b) - shortageOf(a))

  const updateQuantity = (item, next) => setQuantities((current) => ({ ...current, [item.id]: constrainedOrderQty(next, item) }))
  const toggleSelection = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const setBatchDecision = (nextDecision) => {
    setDecisions((current) => ({ ...current, ...Object.fromEntries(selectedIds.map((id) => [id, nextDecision])) }))
    setSelectedIds([])
  }
  const approveAllRecommended = () => setDecisions((current) => ({ ...current, ...Object.fromEntries(candidates.filter((item) => quantities[item.id] > 0).map((item) => [item.id, '승인'])) }))
  const approvedRows = candidates.filter((item) => decisions[item.id] === '승인' && quantities[item.id] > 0)
  const totalUnits = candidates.reduce((sum, item) => sum + Number(quantities[item.id] ?? 0), 0)
  const totalAmount = candidates.reduce((sum, item) => sum + Number(quantities[item.id] ?? 0) * item.price, 0)
  const approvedAmount = approvedRows.reduce((sum, item) => sum + Number(quantities[item.id] ?? 0) * item.price, 0)
  const today = new Date().toISOString().slice(0, 10)
  const trackedOrders = [
    ...liveOrders.map((item) => ({ ...item, isLocal: true })),
    ...bmartReceiptData.openOrders.map((item) => ({ ...item, isLocal: false })),
  ].map((item) => {
    const ordered = Number(item.ordered_qty)
    const received = Number(item.known_received_qty)
    const openQty = Math.max(ordered - received, 0)
    const status = item.cancelled_flag ? '발주 취소' : openQty === 0 ? '입고 완료' : received > 0 ? '부분 입고' : item.expected_arrival_date < today ? '입고 지연' : '입고 예정'
    return { ...item, open_qty: openQty, displayStatus: status }
  })
  const openTrackedOrders = trackedOrders.filter((item) => !['입고 완료', '발주 취소'].includes(item.displayStatus))
  const appendAuditEvents = (events) => {
    const timestamp = new Date().toISOString()
    setAuditLogs((current) => [
      ...events.map((event, index) => ({ id: `AUD-${timestamp}-${current.length + index + 1}`, timestamp, operator: '팀장(로컬)', ...event })),
      ...current,
    ])
  }
  const registerApprovedOrders = () => {
    const createdAt = new Date()
    const expectedAt = new Date(createdAt)
    expectedAt.setDate(expectedAt.getDate() + 5)
    const timestamp = createdAt.getTime()
    const nextOrders = approvedRows.map((item, index) => ({
      purchase_order_id: `PO-LIVE-${timestamp}-${String(index + 1).padStart(3, '0')}`,
      store_id: item.storeId ?? item.store,
      product_id: item.product,
      category: item.category,
      supplier_id: `SUP-${String((index % Math.max(bmartReceiptData.suppliers.length, 1)) + 1).padStart(2, '0')}`,
      order_date: createdAt.toISOString().slice(0, 10),
      expected_arrival_date: expectedAt.toISOString().slice(0, 10),
      ordered_qty: Number(quantities[item.id]),
      known_received_qty: 0,
      data_origin: 'browser-local',
    }))
    setLiveOrders((current) => [...nextOrders, ...current])
    appendAuditEvents(nextOrders.map((item) => ({ action: '발주 등록', purchase_order_id: item.purchase_order_id, product_id: item.product_id, before_value: 0, after_value: item.ordered_qty, detail: `예정 입고일 ${item.expected_arrival_date}` })))
    setDecisions((current) => ({ ...current, ...Object.fromEntries(approvedRows.map((item) => [item.id, '등록 완료'])) }))
    setMode('receipts')
  }
  const receiveOrder = (orderId, value) => {
    const target = liveOrders.find((item) => item.purchase_order_id === orderId)
    if (!target) return
    const before = Number(target.known_received_qty)
    const nextReceived = Math.min(Number(target.ordered_qty), Math.max(0, Number(value) || 0))
    if (before === nextReceived) return
    setLiveOrders((current) => current.map((item) => item.purchase_order_id === orderId ? { ...item, known_received_qty: nextReceived, last_receipt_date: today } : item))
    appendAuditEvents([{ action: nextReceived === Number(target.ordered_qty) ? '전량 입고' : '입고 수량 변경', purchase_order_id: orderId, product_id: target.product_id, before_value: before, after_value: nextReceived, detail: `미입고 ${Number(target.ordered_qty) - nextReceived}개` }])
  }
  const cancelOrder = (orderId) => {
    const target = liveOrders.find((item) => item.purchase_order_id === orderId)
    if (!target || target.cancelled_flag) return
    setLiveOrders((current) => current.map((item) => item.purchase_order_id === orderId ? { ...item, cancelled_flag: true, cancelled_date: today } : item))
    appendAuditEvents([{ action: '발주 취소', purchase_order_id: orderId, product_id: target.product_id, before_value: target.ordered_qty, after_value: 0, detail: `기입고 ${target.known_received_qty}개` }])
  }
  const exportReceiptHistory = () => {
    const headers = ['purchase_order_id', 'store_id', 'product_id', 'supplier_id', 'order_date', 'expected_arrival_date', 'ordered_qty', 'received_qty', 'remaining_qty', 'receipt_status', 'last_receipt_date', 'data_origin']
    const rows = trackedOrders.map((item) => [item.purchase_order_id, item.store_id, item.product_id, item.supplier_id, item.order_date, item.expected_arrival_date, item.ordered_qty, item.known_received_qty, item.open_qty, item.displayStatus, item.last_receipt_date ?? '', item.isLocal ? 'browser-local' : 'simulation'])
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = `\ufeff${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `B마트_입고이력_${today}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const exportAuditLogs = () => {
    const headers = ['audit_id', 'timestamp', 'operator', 'action', 'purchase_order_id', 'product_id', 'before_value', 'after_value', 'detail']
    const rows = auditLogs.map((item) => [item.id, item.timestamp, item.operator, item.action, item.purchase_order_id, item.product_id, item.before_value, item.after_value, item.detail])
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = `\ufeff${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `B마트_감사로그_${today}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  const exportWorkspaceBackup = () => {
    const exportedAt = new Date().toISOString()
    const backup = {
      schema: 'bmart-order-workspace',
      version: 1,
      exported_at: exportedAt,
      data_origin: 'browser-local',
      live_orders: liveOrders,
      audit_logs: auditLogs,
    }
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }))
    link.download = `B마트_작업백업_${today}.json`
    link.click()
    URL.revokeObjectURL(link.href)
    setBackupStatus(`백업 완료 · 발주 ${liveOrders.length}건 · 로그 ${auditLogs.length}건`)
  }
  const importWorkspaceBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setBackupStatus('불러오기 실패 · 파일은 5MB 이하여야 합니다.')
      return
    }
    try {
      const backup = JSON.parse(await file.text())
      const validHeader = backup?.schema === 'bmart-order-workspace' && backup?.version === 1
      const validArrays = Array.isArray(backup?.live_orders) && Array.isArray(backup?.audit_logs) && backup.live_orders.length <= 5000 && backup.audit_logs.length <= 20000
      const validOrders = validArrays && backup.live_orders.every((item) => typeof item?.purchase_order_id === 'string' && typeof item?.product_id === 'string' && Number.isFinite(Number(item?.ordered_qty)) && Number(item.ordered_qty) >= 0 && Number.isFinite(Number(item?.known_received_qty)) && Number(item.known_received_qty) >= 0 && Number(item.known_received_qty) <= Number(item.ordered_qty))
      const validLogs = validArrays && backup.audit_logs.every((item) => typeof item?.id === 'string' && typeof item?.timestamp === 'string' && typeof item?.action === 'string')
      if (!validHeader || !validArrays || !validOrders || !validLogs) throw new Error('지원하지 않는 백업 구조입니다.')
      const restoredAt = new Date().toISOString()
      const restoreLog = { id: `AUD-${restoredAt}-RESTORE`, timestamp: restoredAt, operator: '팀장(로컬)', action: '백업 복원', purchase_order_id: '-', product_id: '-', before_value: liveOrders.length, after_value: backup.live_orders.length, detail: `${file.name} · 로그 ${backup.audit_logs.length}건 복원` }
      setLiveOrders(backup.live_orders)
      setAuditLogs([restoreLog, ...backup.audit_logs])
      setBackupStatus(`복원 완료 · 발주 ${backup.live_orders.length}건 · 로그 ${backup.audit_logs.length}건`)
    } catch (error) {
      setBackupStatus(`불러오기 실패 · ${error instanceof Error ? error.message : 'JSON 파일을 확인하세요.'}`)
    }
  }
  const exportOrders = () => {
    const headers = ['store_id', 'product_id', 'product_name', 'risk', 'inventory_position', 'target_stock', 'recommended_order_qty', 'final_order_qty', 'pack_size', 'minimum_order_qty', 'unit_price', 'order_amount', 'decision']
    const rows = approvedRows.map((item) => [item.storeId ?? item.store, item.product, item.label, item.risk, item.inventoryPosition ?? item.stock, item.targetStock, item.orderQty, quantities[item.id], item.packSize ?? 1, item.minimumOrderQty ?? 0, item.price, quantities[item.id] * item.price, decisions[item.id]])
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = `\ufeff${[headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')}`
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `${mart}마트_발주안_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (mode === 'audit' && mart === 'B') return <section className="content-page detail-page order-detail-page receipt-detail-page audit-detail-page">
    <DetailHeader title="변경 이력" description="발주 등록·입고 수량 변경·취소 작업의 사용자와 변경 전후 값을 추적합니다." mart={mart} badge="감사 로그" />
    <div className="order-mode-tabs"><button onClick={() => setMode('orders')}>발주 검토</button><button onClick={() => setMode('receipts')}>입고 추적</button><button className="active" onClick={() => setMode('audit')}>변경 이력</button><span>LOCAL AUDIT</span></div>
    <div className="simulation-notice audit-notice"><b>로컬 감사 기록</b><span>로그인 기능이 없어 작업자는 팀장(로컬)로 기록됩니다. 운영 배포 시 인증 사용자 ID와 서버 시간을 사용해야 합니다.</span>{backupStatus && <em>{backupStatus}</em>}</div>
    <section className="detail-metric-grid">
      <DetailMetric label="전체 변경" value={auditLogs.length} unit="건" note="현재 브라우저 기준" tone="purple" />
      <DetailMetric label="발주 등록" value={auditLogs.filter((item) => item.action === '발주 등록').length} unit="건" note="입고 원장 생성" tone="blue" />
      <DetailMetric label="입고 변경" value={auditLogs.filter((item) => item.action.includes('입고')).length} unit="건" note="수량 변경·완료" tone="green" />
      <DetailMetric label="발주 취소" value={auditLogs.filter((item) => item.action === '발주 취소').length} unit="건" note="취소 이력 보존" tone="red" />
    </section>
    <article className="panel detail-table-panel audit-log-panel"><div className="panel-header"><div><h2>발주·입고 변경 이력</h2><p>최신 작업부터 표시하며 삭제 기능은 제공하지 않습니다.</p></div><div className="backup-actions"><button onClick={exportWorkspaceBackup}>작업 백업</button><label><input type="file" accept="application/json,.json" onChange={importWorkspaceBackup} />백업 불러오기</label><button className="audit-export" onClick={exportAuditLogs} disabled={auditLogs.length === 0}>로그 CSV</button></div></div><div className="table-scroll"><table className="detail-table audit-table"><thead><tr><th>변경 시각(UTC)</th><th>작업자</th><th>작업</th><th>발주번호</th><th>상품</th><th>변경 전</th><th>변경 후</th><th>세부 내용</th></tr></thead><tbody>{auditLogs.map((item) => <tr key={item.id}><td>{item.timestamp.replace('T', ' ').slice(0, 19)}</td><td>{item.operator}</td><td><span className="audit-action">{item.action}</span></td><td><b>{item.purchase_order_id}</b></td><td>{item.product_id}</td><td>{number(item.before_value)}</td><td>{number(item.after_value)}</td><td>{item.detail}</td></tr>)}</tbody></table>{auditLogs.length === 0 && <div className="detail-empty">아직 기록된 변경 작업이 없습니다.</div>}</div></article>
  </section>

  if (mode === 'receipts' && mart === 'B') return <section className="content-page detail-page order-detail-page receipt-detail-page">
    <DetailHeader title="입고 추적" description="발주 이후 입고 예정·부분 입고·지연 상태와 공급처 이행률을 확인합니다." mart={mart} badge="입고 파이프라인" />
    <div className="order-mode-tabs"><button onClick={() => setMode('orders')}>발주 검토</button><button className="active" onClick={() => setMode('receipts')}>입고 추적</button><button onClick={() => setMode('audit')}>변경 이력 <em>{auditLogs.length}</em></button><span>SIMULATION + LOCAL</span></div>
    <div className="simulation-notice"><b>모의 입고 데이터</b><span>{bmartReceiptData.metadata.interpretation}</span></div>
    <section className="detail-metric-grid">
      <DetailMetric label="미결 발주" value={openTrackedOrders.length} unit="건" note={`미입고 ${number(openTrackedOrders.reduce((sum, item) => sum + item.open_qty, 0))}개`} tone="purple" />
      <DetailMetric label="입고 지연" value={openTrackedOrders.filter((item) => item.displayStatus === '입고 지연').length} unit="건" note="예정일을 지난 발주" tone="red" />
      <DetailMetric label="부분 입고" value={openTrackedOrders.filter((item) => item.displayStatus === '부분 입고').length} unit="건" note="잔여 수량 추적 필요" tone="amber" />
      <DetailMetric label="유효 입고예정" value={number(Math.round(bmartReceiptData.summary.effectiveIncomingQty + liveOrders.filter((item) => !item.cancelled_flag).reduce((sum, item) => sum + Math.max(Number(item.ordered_qty) - Number(item.known_received_qty), 0), 0)))} unit="개" note={`지연분 ${Math.round(bmartReceiptData.metadata.delayedReceiptWeight * 100)}% 인정`} tone="green" />
    </section>
    <section className="order-management-layout receipt-management-layout">
      <article className="panel detail-table-panel"><div className="panel-header"><div><h2>입고 예정·지연 목록</h2><p>직접 입력한 입고량으로 미입고 수량과 상태를 자동 계산합니다.</p></div><span>{trackedOrders.length}건 · 신규 {liveOrders.length}건</span></div><div className="table-scroll"><table className="detail-table receipt-table"><thead><tr><th>발주번호</th><th>상품·매장</th><th>공급처</th><th>발주일</th><th>예정 입고일</th><th>발주량</th><th>확인 입고</th><th>미입고</th><th>상태</th><th>입고 처리</th></tr></thead><tbody>{trackedOrders.map((item) => <tr key={item.purchase_order_id} className={item.isLocal ? 'live-order-row' : ''}><td><b>{item.purchase_order_id}</b><small>{item.isLocal ? '브라우저 등록' : '모의 원장'}</small></td><td><b>{item.product_id}</b><small>{item.store_id} · {item.category}</small></td><td>{item.supplier_id}</td><td>{item.order_date}</td><td>{item.expected_arrival_date}</td><td>{number(Number(item.ordered_qty))}</td><td>{item.isLocal && !item.cancelled_flag ? <input className="receipt-qty-input" aria-label={`${item.purchase_order_id} 누적 입고 수량`} type="number" min="0" max={item.ordered_qty} value={item.known_received_qty} onChange={(event) => receiveOrder(item.purchase_order_id, event.target.value)} /> : number(Number(item.known_received_qty))}</td><td>{number(Number(item.open_qty))}</td><td><span className={`receipt-status ${item.displayStatus === '입고 지연' || item.displayStatus === '발주 취소' ? 'delayed' : item.displayStatus === '입고 완료' ? 'complete' : 'incoming'}`}>{item.displayStatus}</span></td><td>{item.isLocal && !['입고 완료', '발주 취소'].includes(item.displayStatus) ? <div className="receipt-actions"><button onClick={() => receiveOrder(item.purchase_order_id, item.ordered_qty)}>전량 입고</button><button className="cancel" onClick={() => cancelOrder(item.purchase_order_id)}>발주 취소</button></div> : <span className="readonly-receipt">{item.isLocal ? '처리 완료' : '조회 전용'}</span>}</td></tr>)}</tbody></table></div></article>
      <aside className="panel order-confirm-panel supplier-panel"><div className="panel-header"><div><h2>공급처 이행률</h2><p>완료 발주 사후 통계</p></div></div><div className="supplier-list">{bmartReceiptData.suppliers.map((item) => <div key={item.supplier_id}><p><b>{item.supplier_id}</b><small>P90 {Number(item.p90_lead_time).toFixed(1)}일</small></p><span>정시입고 <strong>{(Number(item.on_time_rate) * 100).toFixed(1)}%</strong></span><span>완전입고 <strong>{(Number(item.complete_fill_rate) * 100).toFixed(1)}%</strong></span></div>)}</div><div className="order-policy-note"><b>해석 기준</b><p>실제 ERP 입고 이력 연결 전의 시뮬레이션입니다.</p><p>운영 성과가 아닌 화면·계산 흐름 검증용입니다.</p></div><button className="export-orders receipt-export" onClick={exportReceiptHistory}>입고 이력 CSV 내보내기</button></aside>
    </section>
  </section>

  return <section className={`content-page detail-page order-detail-page ${mart === 'B' ? 'receipt-enabled' : ''}`}>
    <DetailHeader title="발주 관리" description="입고 예정량을 차감한 권장량을 검토하고 MOQ·박스 단위를 반영해 발주안을 확정합니다." mart={mart} badge="검토·승인·내보내기" />
    {mart === 'B' && <><div className="order-mode-tabs"><button className="active" onClick={() => setMode('orders')}>발주 검토</button><button onClick={() => setMode('receipts')}>입고 추적 <em>{openTrackedOrders.filter((item) => item.displayStatus === '입고 지연').length}</em></button><button onClick={() => setMode('audit')}>변경 이력 <em>{auditLogs.length}</em></button><span>SIMULATION + LOCAL</span></div><div className="simulation-notice"><b>입고 반영 발주</b><span>입고 예정량을 재고 위치에 포함해 중복 발주를 줄입니다. 현재 입고 이력은 모의 데이터입니다.</span></div></>}
    <section className="detail-metric-grid">
      <DetailMetric label="검토 대상" value={candidates.length} unit="개" note="발주 또는 위험 상품" tone="purple" />
      <DetailMetric label="입고 반영 발주량" value={number(totalUnits)} unit="개" note="입고예정 차감 후 수량" tone="blue" />
      <DetailMetric label="승인 완료" value={approvedRows.length} unit="개" note={`승인 금액 ${formatCurrency(approvedAmount, mart)}`} tone="green" />
      <DetailMetric label="총 예상 금액" value={formatCurrency(totalAmount, mart)} unit="" note="세금·운송비 제외" tone="amber" />
    </section>
    <div className="order-workflow"><div className="complete"><span>1</span><p><b>입고 반영 추천</b><small>현재고+입고예정 계산</small></p></div><i /><div className="active"><span>2</span><p><b>담당자 검토</b><small>수량·우선순위 조정</small></p></div><i /><div><span>3</span><p><b>발주안 승인</b><small>승인·보류 결정</small></p></div><i /><div><span>4</span><p><b>입고 추적</b><small>부분입고·지연 관리</small></p></div></div>
    <div className="detail-filterbar order-filterbar"><FilterSelect label="매장" value={store} onChange={setStore} options={stores} /><FilterSelect label="검토 상태" value={decision} onChange={setDecision} options={['전체 상태', '검토 필요', '승인', '보류']} /><label className="filter-field search-field"><span>상품 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상품명 또는 상품 ID" /></label></div>
    {selectedIds.length > 0 && <div className="batch-actionbar"><p><strong>{selectedIds.length}개</strong> 상품 선택</p><div><button onClick={() => setBatchDecision('보류')}>선택 보류</button><button className="primary" onClick={() => setBatchDecision('승인')}>선택 승인</button></div></div>}
    <section className="order-management-layout">
      <article className="panel detail-table-panel">
        <div className="panel-header"><div><h2>발주 검토 목록</h2><p>수량 변경 시 박스 단위와 MOQ를 자동 적용합니다.</p></div><span>{filtered.length}개 상품</span></div>
        <div className="table-scroll"><table className="detail-table order-management-table"><thead><tr><th><input type="checkbox" aria-label="현재 목록 전체 선택" checked={filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...filtered.map((item) => item.id)])] : selectedIds.filter((id) => !filtered.some((item) => item.id === id)))} /></th><th>상품</th><th>매장</th><th>위험</th><th>입고 반영 위치</th><th>목표재고</th><th>기존 권장</th><th>입고 반영</th><th>최종 발주</th><th>판정</th></tr></thead><tbody>{filtered.map((item) => { const qty = quantities[item.id] ?? 0; const pack = item.packSize ?? 1; return <tr key={item.id} className={selectedIds.includes(item.id) ? 'selected-row' : ''}><td><input type="checkbox" aria-label={`${item.label} 선택`} checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /></td><td><b>{item.label}</b><small>{item.product} · 박스 {pack} · MOQ {item.minimumOrderQty ?? 0}</small></td><td>{item.store}</td><td><RiskBadge risk={item.risk} /></td><td>{number(item.receipt?.receiptAdjustedInventoryPosition ?? item.inventoryPosition ?? item.stock)}<small>입고 {number(item.receipt?.effectiveIncomingQty ?? 0)}</small></td><td>{number(item.targetStock)}</td><td>{number(item.originalOrderQty)}</td><td><b className="adjusted-order-value">{number(item.orderQty)}</b></td><td><div className="compact-stepper"><button onClick={() => updateQuantity(item, qty - pack)}>−</button><input aria-label={`${item.label} 최종 발주 수량`} type="number" min="0" step={pack} value={qty} onChange={(event) => updateQuantity(item, Number(event.target.value))} /><button onClick={() => updateQuantity(item, qty + pack)}>+</button></div></td><td><div className="decision-buttons"><button className={decisions[item.id] === '보류' ? 'hold active' : 'hold'} onClick={() => setDecisions((current) => ({ ...current, [item.id]: '보류' }))}>보류</button><button className={decisions[item.id] === '승인' ? 'approve active' : 'approve'} onClick={() => setDecisions((current) => ({ ...current, [item.id]: '승인' }))}>승인</button></div></td></tr>})}</tbody></table></div>
      </article>
      <aside className="panel order-confirm-panel"><div className="panel-header"><div><h2>발주안 요약</h2><p>승인된 상품을 입고 원장에 등록합니다.</p></div></div><div className="order-confirm-copy"><div><span>승인 SKU</span><strong>{approvedRows.length}개</strong></div><div><span>승인 수량</span><strong>{number(approvedRows.reduce((sum, item) => sum + quantities[item.id], 0))}개</strong></div><div><span>승인 금액</span><strong>{formatCurrency(approvedAmount, mart)}</strong></div></div><div className="order-policy-note"><b>발주 정책</b><p>재고 위치 = 현재고 + 입고예정 − 미납</p><p>박스 단위 반올림 후 MOQ 적용</p><p>등록 결과는 이 브라우저에 저장</p></div><button className="approve-recommended" onClick={approveAllRecommended}>권장 발주 전체 승인</button><button className="register-orders" onClick={registerApprovedOrders} disabled={approvedRows.length === 0}>승인 발주를 입고 원장에 등록</button><button className="export-orders" onClick={exportOrders} disabled={approvedRows.length === 0}>승인 발주안 CSV 내보내기</button></aside>
    </section>
  </section>
}

function PlaceholderPage({ active }) {
  const label = menu.find((item) => item[0] === active)?.[2]
  return <section className="content-page"><div className="content-title"><h1>{label}</h1><p>대시보드 공통 데이터를 기반으로 상세 화면을 확장할 예정입니다.</p></div><article className="panel empty-state"><strong>{label} 화면</strong><p>실제 A·B마트 모델 결과가 확정되면 차트와 필터를 연결합니다.</p></article></section>
}

function DetailRouter({ active, mart, products }) {
  if (active === 'risk') return <RiskPage mart={mart} products={products} />
  if (active === 'inventory') return <InventoryPage mart={mart} products={products} />
  if (active === 'analysis') return <DemandAnalysisPage mart={mart} products={products} />
  if (active === 'orders') return <OrderManagementPage key={mart} mart={mart} products={products} />
  return <PlaceholderPage active={active} />
}

function App() {
  // 화면 이동, 마트·매장 선택, 발주 수량과 승인 상태를 관리하는 공통 상태입니다.
  const [active, setActive] = useState('dashboard')
  const [mart, setMart] = useState('A')
  const [store, setStore] = useState('전체 매장')
  const [selected, setSelected] = useState(dashboardProducts[0])
  const [quantities, setQuantities] = useState({})
  const [approvals, setApprovals] = useState({})
  const [toast, setToast] = useState('')
  const [showModel, setShowModel] = useState(false)

  // 선택한 마트와 매장에 해당하는 상품만 대시보드 전체에 전달합니다.
  const rows = useMemo(() => dashboardProducts.filter((item) => item.mart === mart && (store === '전체 매장' || item.store === store)), [mart, store])

  const changeMart = (next) => {
    setMart(next)
    setStore('전체 매장')
    setSelected(dashboardProducts.find((item) => item.mart === next))
  }

  const approveAll = () => {
    // 발주량이 있는 상품을 한 번에 승인하고 잠시 안내 메시지를 띄웁니다.
    setApprovals(Object.fromEntries(rows.filter((row) => row.orderQty > 0).map((row) => [row.id, true])))
    setToast(`${mart}마트 발주안이 승인되었습니다.`)
    window.setTimeout(() => setToast(''), 2400)
  }

  // 팝업과 토스트는 축소되는 대시보드 바깥에 두어 항상 브라우저 전체를 기준으로 표시합니다.
  return <>
    <div className="app-shell"><Sidebar active={active} setActive={setActive} mart={mart} setMart={changeMart} onOpenModel={() => setShowModel(true)} /><main className="app-content">{active === 'dashboard' ? <Dashboard mart={mart} store={store} setStore={setStore} rows={rows} selected={selected} setSelected={setSelected} quantities={quantities} setQuantities={setQuantities} approvals={approvals} approveAll={approveAll} /> : <DetailRouter active={active} mart={mart} products={dashboardProducts.filter((item) => item.mart === mart)} />}</main></div>
    <ModelModal open={showModel} onClose={() => setShowModel(false)} mart={mart} />
    {toast && <div className="toast">✓ {toast}</div>}
  </>
}

export default App
