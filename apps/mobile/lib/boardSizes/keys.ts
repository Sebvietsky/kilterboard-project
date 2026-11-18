export const boardSizeKeys = {
  all: ['boardSizes'] as const,
  list: () => [...boardSizeKeys.all, 'list'] as const,
  detail: (id: number) => [...boardSizeKeys.all, 'detail', id] as const,
};
