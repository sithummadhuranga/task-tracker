import { buildPaginationMeta } from "../../src/common/pagination.js";

describe("buildPaginationMeta", () => {
  it("computes totalPages from total and limit", () => {
    expect(buildPaginationMeta(1, 10, 25)).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });

  it("floors totalPages at 1 for an empty result set, instead of 0", () => {
    expect(buildPaginationMeta(1, 10, 0)).toEqual({ page: 1, limit: 10, total: 0, totalPages: 1 });
  });

  it("passes page and limit straight through", () => {
    expect(buildPaginationMeta(3, 20, 41)).toEqual({ page: 3, limit: 20, total: 41, totalPages: 3 });
  });
});
