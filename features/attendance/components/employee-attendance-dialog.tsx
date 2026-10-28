'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { Clock3, CalendarDays } from 'lucide-react';
import { AppButton as Button } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { errorMessage } from '@/lib/api-client';
import { attendanceApi } from '../api/attendance-api';
import { label, shortDate, vietnamTime } from '../helpers/format';
import type { Employee } from '../types';

type Props = { employee: Employee; initialDate: string; onClose: () => void };

export function EmployeeAttendanceDialog({ employee, initialDate, onClose }: Props) {
  const [date, setDate] = useState(initialDate);
  const scans = useQuery({
    queryKey: ['scans', 'employee-day', employee.id, date],
    queryFn: () => attendanceApi.employeeDayScans(employee.id, date),
    enabled: !!date,
    refetchInterval: 15000,
  });
  const schedules = useQuery({
    queryKey: ['schedules', 'employee-day', employee.id, date],
    queryFn: () => attendanceApi.schedules({ employee_id: employee.id, date }),
    enabled: !!date,
  });
  const events = [...(scans.data ?? [])].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.id - b.id);
  const accepted = events.filter((event) => event.outcome === 'ACCEPTED');
  const schedule = schedules.data?.results.find((item) => item.status !== 'CANCELLED');

  return <Dialog open onClose={onClose} aria-labelledby="employee-attendance-title" fullWidth maxWidth="sm">
    <DialogTitle id="employee-attendance-title">Chấm công của {employee.full_name}</DialogTitle>
    <DialogContent dividers>
      <div className="employee-attendance">
        <p className="employee-attendance-meta">{employee.employee_code} · {employee.home_facility_name}</p>
        <FormField label="Ngày xem chấm công" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        <p className="employee-attendance-note">Mặc định theo ngày trên đồng hồ chấm công; có thể chọn ngày khác.</p>
        {!date ? <Alert severity="info">Chọn ngày để xem lượt chấm công.</Alert> : <>
          <div className="employee-attendance-summary">
            <div><CalendarDays size={18}/><span><small>Ca làm việc</small><strong>{schedules.isLoading ? 'Đang tải…' : schedules.isError ? 'Không tải được' : schedule ? `${vietnamTime(schedule.starts_at).slice(0, 5)} – ${vietnamTime(schedule.ends_at).slice(0, 5)}` : 'Chưa có ca'}</strong></span></div>
            <div><Clock3 size={18}/><span><small>Lượt đã ghi nhận</small><strong>{scans.isLoading ? 'Đang tải…' : scans.isError ? 'Không tải được' : `${accepted.length} lượt`}</strong></span></div>
          </div>
          {schedules.isError && <Alert severity="warning" action={<Button onClick={() => void schedules.refetch()}>Thử lại</Button>}>Không tải được ca làm việc: {errorMessage(schedules.error)}</Alert>}
          <div className="employee-timeline-heading"><h3>Dòng thời gian</h3><span>{shortDate(date)}</span></div>
          {scans.isLoading ? <p className="employee-attendance-note" role="status">Đang tải lượt chấm…</p> : scans.isError ? <Alert severity="error" action={<Button onClick={() => void scans.refetch()}>Thử lại</Button>}>Không tải được lượt chấm: {errorMessage(scans.error)}</Alert> : events.length === 0 ? <div className="employee-timeline-empty">Chưa có lượt chấm công trong ngày này.</div> : <ol className="employee-timeline">
            {events.map((event) => <li key={event.id}>
              <time>{vietnamTime(event.occurred_at)}</time><span className={`employee-timeline-dot ${event.outcome === 'ACCEPTED' ? 'accepted' : 'attention'}`}/>
              <div><strong>{event.outcome === 'ACCEPTED' && event.event_type ? `Chấm ${label(event.event_type).toLowerCase()}` : label(event.outcome)} · {event.facility_name}</strong><p>{event.decision_snapshot.message || label(event.reason_code)}</p>{event.decision_snapshot.warnings?.map((warning, index) => <p className="employee-timeline-warning" key={`${event.id}-${index}`}>{label(warning)}</p>)}</div>
            </li>)}
          </ol>}
          <p className="employee-attendance-note">Dòng thời gian hiển thị lượt quét gốc; các điều chỉnh đã duyệt chưa được thể hiện tại đây. Công thực tế chưa được tính tự động.</p>
        </>}
      </div>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
  </Dialog>;
}
