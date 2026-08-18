import "./styles/StoreSelector.css";

export default function StoreSelector({ stores, value, onChange }) {
  // 매장 코드를 한글 이름으로 변환해주는 헬퍼 함수
  const getStoreDisplayName = (storeCode) => {
    const storeMap = {
      STR_001: "매장 1",
      STR_002: "매장 2",
      STR_003: "매장 3",
      STR_004: "매장 4",
      STR_005: "매장 5",
    };
    // 매핑된 이름이 없으면 원래 코드 그대로 출력
    return storeMap[storeCode] || storeCode;
  };

  return (
    <label className="store-selector">
      <span>매장 선택</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="ALL">전체 매장</option>
        {stores.map((store) => (
          <option key={store} value={store}>
            {getStoreDisplayName(store)}
          </option>
        ))}
      </select>
    </label>
  );
}