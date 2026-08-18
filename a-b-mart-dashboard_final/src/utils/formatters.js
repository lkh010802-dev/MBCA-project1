export const getProductName = (productId) => {
  if (!productId) return "미분류";
  const productMap = {
    "PRD_01_ELEC": "가전제품 A",
    "PRD_02_ELEC": "가전제품 B",
    "PRD_03_GROC": "신선 식료품 A",
    "PRD_04_GROC": "신선 식료품 B",
    "PRD_05_FASH": "의류 상품 A",
    "PRD_06_FASH": "의류 상품 B",
    "PRD_07_HOME": "홈/리빙 상품 A",
    "PRD_08_HOME": "홈/리빙 상품 B",
  };
  // 공백 제거 후 매칭
  const key = String(productId).trim();
  return productMap[key] || key;
};

export const getStoreName = (storeId) => {
  if (!storeId) return "미분류";
  const storeMap = {
    "STR_001": "매장 1",
    "STR_002": "매장 2",
    "STR_003": "매장 3",
    "STR_004": "매장 4",
    "STR_005": "매장 5",
  };
  const key = String(storeId).trim();
  return storeMap[key] || key;
};

export const getCategoryName = (category) => {
  if (!category) return "미분류";
  const categoryMap = {
    "Apparel": "의류",
    "Electronics": "가전",
    "Grocery": "식료품",
    "Home": "홈/리빙",
  };
  const key = String(category).trim();
  return categoryMap[key] || key;
};