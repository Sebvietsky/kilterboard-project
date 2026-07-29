import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Grade } from './types';
import { api } from '../api/client';

export function useGrades(): UseQueryResult<Grade[], Error> {
  return useQuery({
    queryKey: ['grades'],
    queryFn: () => api.get<Grade[]>('/grades'),
    staleTime: Infinity,
  });
}
