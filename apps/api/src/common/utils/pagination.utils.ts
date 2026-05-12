export function getPaginationParams(page?: number, limit?: number) {
  const currentPage = page ?? 1;
  const currentLimit = limit ?? 20;
  return {
    skip: (currentPage - 1) * currentLimit,
    take: currentLimit,
  };
}

export function getSafeOrderBy<T extends string>(
  allowedFields: readonly T[],
  orderBy?: string,
  defaultField: T = allowedFields[0],
): T {
  return allowedFields.includes(orderBy as T) ? (orderBy as T) : defaultField;
}
