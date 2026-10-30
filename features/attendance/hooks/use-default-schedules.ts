'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../api/attendance-api';
import { vietnamDate } from '../helpers/format';

export function useDefaultSchedules(workDate: string) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<{ date: string; error: boolean } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    if (!workDate) return;
    if (workDate < vietnamDate(Date.now())) {
      void Promise.resolve().then(() => { if (active) setResult({ date: workDate, error: false }); });
      return () => { active = false; };
    }
    void attendanceApi.ensureDefaultSchedules(workDate).then(() => {
      if (!active) return;
      setResult({ date: workDate, error: false });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
    }).catch(() => { if (active) setResult({ date: workDate, error: true }); });
    return () => { active = false; };
  }, [workDate, retryCount, queryClient]);
  return { pending: !!workDate && result?.date !== workDate, error: result?.date === workDate && result.error,
    retry: () => setRetryCount((value) => value + 1) };
}
