module.exports.parsePagination = (query = {}) => {
  const limit = Math.min(Math.max(parseInt(query.limit || 20, 10), 1), 100);
  const page = Math.max(parseInt(query.page || 1, 10), 1);
  const offset = (page - 1) * limit;
  return { limit, page, offset };
};

module.exports.packResult = ({ rows, count }, { limit, page }) => ({
  items: rows,
  total: count,
  limit,
  page,
  pages: Math.ceil(count / limit) || 1
});
