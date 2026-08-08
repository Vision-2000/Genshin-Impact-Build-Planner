import { describe, it, expect } from "vitest";
import { paginate } from "./paginate";

describe("paginate", () => {
  it("returns all items on one page when they fit within pageSize", () => {
    const result = paginate([1, 2, 3], 1, 10);
    expect(result).toEqual({ pageItems: [1, 2, 3], pageCount: 1, currentPage: 1 });
  });

  it("splits items across multiple pages", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginate(items, 1, 2)).toEqual({ pageItems: [1, 2], pageCount: 3, currentPage: 1 });
    expect(paginate(items, 2, 2)).toEqual({ pageItems: [3, 4], pageCount: 3, currentPage: 2 });
    expect(paginate(items, 3, 2)).toEqual({ pageItems: [5], pageCount: 3, currentPage: 3 });
  });

  it("clamps a page number beyond the last page down to the last page", () => {
    const result = paginate([1, 2, 3], 99, 2);
    expect(result.currentPage).toBe(2);
    expect(result.pageItems).toEqual([3]);
  });

  it("clamps a page number below 1 up to page 1", () => {
    const result = paginate([1, 2, 3], 0, 2);
    expect(result.currentPage).toBe(1);
    expect(result.pageItems).toEqual([1, 2]);

    const negative = paginate([1, 2, 3], -5, 2);
    expect(negative.currentPage).toBe(1);
  });

  it("returns an empty page with pageCount 1 for an empty list, never dividing by zero into an empty range", () => {
    const result = paginate([], 1, 10);
    expect(result).toEqual({ pageItems: [], pageCount: 1, currentPage: 1 });
  });

  it("returns exactly one full page when item count is an exact multiple of pageSize", () => {
    const items = [1, 2, 3, 4];
    const result = paginate(items, 2, 2);
    expect(result.pageCount).toBe(2);
    expect(result.pageItems).toEqual([3, 4]);
  });
});
