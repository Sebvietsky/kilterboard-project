export const draftKeys = {
  all: ['drafts'] as const,
  mine: () => [...draftKeys.all, 'mine'] as const,
  detail: (id: number) => [...draftKeys.all, 'detail', id] as const,
};
