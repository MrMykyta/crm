export function normalizeItemSortOrder(items = []) {
  return (items || []).map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export function sortItemsBySortOrder(items = []) {
  return [...(items || [])].sort((a, b) => {
    const aValue = Number(a?.sortOrder);
    const bValue = Number(b?.sortOrder);
    const aOrder = Number.isFinite(aValue) ? aValue : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(bValue) ? bValue : Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}
