// Generic pagination math, shared across the characters/weapons/artifacts
// list pages rather than reimplemented per page.
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { pageItems, pageCount, currentPage };
}
