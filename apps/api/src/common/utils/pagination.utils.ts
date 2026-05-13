import { PaginationOutput } from '../interfaces/get-pagination.interface';

export function getPaginationParams(
  page?: number,
  limit?: number,
): PaginationOutput {
  const currentPage: number = page ?? 1;
  const currentLimit: number = limit ?? 20;
  return {
    skip: (currentPage - 1) * currentLimit,
    take: currentLimit,
    page: currentPage,
    limit: currentLimit,
  };
}

export function getSafeOrderBy<T extends string>(
  allowedFields: readonly T[],
  orderBy?: string,
  defaultField: T = allowedFields[0],
): T {
  return allowedFields.includes(orderBy as T) ? (orderBy as T) : defaultField;
}
