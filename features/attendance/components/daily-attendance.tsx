'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Pagination } from '@mui/material';
import { Download, RefreshCw, Search } from 'lucide-react';
import { AppButton as Button } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { errorMessage } from '@/lib/api-client';
import { attendanceApi } from '../api/attendance-api';
import { shortDate, vietnamTime } from '../helpers/format';
import type { AttendanceRequest, Employee, Facility, HrAlert, Scan, Schedule } from '../types';
import { EmployeeAttendanceDialog } from './employee-attendance-dialog';

type Event = { id: string; time: string; type: 'IN' | 'OUT'; facility: number };
type DailyData = { scans: Scan[]; schedules: Schedule[]; alerts: HrAlert[]; requests: AttendanceRequest[] };
type Row = { employee: Employee; first: Event | undefined; last: Event | undefined; late: boolean; review: boolean; reason: string; lastFacility: string };
type Tab = 'all' | 'review' | 'late';

function buildRow(employee: Employee, data: DailyData, facilities: Facility[], now: number): Row {
  const schedule = data.schedules.find((s) => s.employee === employee.id && s.status === 'SCHEDULED');
  const scans = data.scans.filter((s) => s.employee_id === employee.id);
  const requests = data.requests.filter((r) => r.employee === employee.id);
  const events = new Map<string, Event>();
  for (const scan of scans) {
    if (scan.outcome === 'ACCEPTED' && scan.event_type) events.set(`scan:${scan.id}`, { id: `scan:${scan.id}`, time: scan.occurred_at, type: scan.event_type, facility: scan.facility_id });
  }
  for (const request of requests.filter((r) => r.status === 'APPROVED')) {
    if (request.target_scan !== null) events.delete(`scan:${request.target_scan}`);
    if (request.request_type !== 'VOID_EVENT' && request.proposed_occurred_at && (request.proposed_event_type === 'IN' || request.proposed_event_type === 'OUT') && request.proposed_facility) {
      events.set(`request:${request.id}`, { id: `request:${request.id}`, time: request.proposed_occurred_at, type: request.proposed_event_type, facility: request.proposed_facility });
    }
  }
  const ordered = [...events.values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
  const first = ordered.find((event) => event.type === 'IN');
  const last = ordered.at(-1);
  const badSequence = ordered.some((event, index) => index === 0 ? event.type === 'OUT' : event.type === ordered[index - 1].type);
  const pending = requests.some((r) => r.status === 'PENDING') || scans.some((s) => s.outcome === 'PENDING_REVIEW' && !requests.some((r) => r.origin_scan === s.id && r.status !== 'PENDING'));
  const openAlert = data.alerts.some((a) => a.employee === employee.id && a.status === 'OPEN');
  const missingOut = !!schedule && !!last && last.type === 'IN' && now >= Date.parse(schedule.ends_at);
  const noSchedule = !schedule && ordered.length > 0;
  const review = pending || openAlert || badSequence || missingOut || noSchedule;
  const late = !!schedule && !!first && Date.parse(first.time) > Date.parse(schedule.starts_at);
  const reason = pending ? 'Có yêu cầu chờ xử lý' : openAlert ? 'Cảnh báo HR chưa xác minh' : badSequence ? 'Chuỗi lượt cần xác minh' : missingOut ? 'Chưa có lượt ra cuối ca' : noSchedule ? 'Chưa có ca làm việc' : !ordered.length ? 'Chưa có lượt' : last?.type === 'IN' ? 'Đang trong ca' : 'Đã có lượt vào / ra';
  return { employee, first, last, late, review, reason, lastFacility: facilities.find((f) => f.id === last?.facility)?.name ?? '—' };
}

function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function exportCsv(rows: Row[], date: string) {
  const data = [['Mã nhân viên', 'Nhân viên', 'Cơ sở cuối', 'Vào đầu', 'Ra cuối', 'Trạng thái', 'Công thường'], ...rows.map((r) => [r.employee.employee_code, r.employee.full_name, r.lastFacility, r.first ? vietnamTime(r.first.time) : '', r.last?.type === 'OUT' ? vietnamTime(r.last.time) : '', `${r.reason}${r.late ? ' · Vào sau giờ ca' : ''}`, 'Chưa tính'])];
  const blob = new Blob(['\ufeff', data.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `cham-cong-${date}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DailyAttendance({ employees, facilities, initialDate, now }: { employees: Employee[]; facilities: Facility[]; initialDate: string; now: number }) {
  const [date, setDate] = useState(initialDate);
  const [search, setSearch] = useState('');
  const [facility, setFacility] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Employee | null>(null);
  const nowSecond = Math.floor(now / 1000) * 1000;
  const query = useQuery({
    queryKey: ['daily-attendance', date],
    queryFn: async (): Promise<DailyData> => {
      const [scans, schedules, alerts, requests] = await Promise.all([attendanceApi.dailyScans(date), attendanceApi.dailySchedules(date), attendanceApi.dailyAlerts(date), attendanceApi.dailyRequests(date)]);
      return { scans, schedules, alerts, requests };
    },
    enabled: !!date,
    refetchInterval: 30000,
  });
  const rows = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLocaleLowerCase('vi');
    return employees.map((employee) => buildRow(employee, query.data!, facilities, nowSecond))
      .filter((row) => (!facility || row.employee.home_facility_id === Number(facility)) && (!term || `${row.employee.employee_code} ${row.employee.full_name}`.toLocaleLowerCase('vi').includes(term)) && (tab === 'all' || (tab === 'review' ? row.review : row.late)));
  }, [query.data, employees, facilities, nowSecond, search, facility, tab]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 15));
  const visiblePage = Math.min(page, pageCount);
  const tabs: { key: Tab; text: string }[] = [{ key: 'all', text: 'Tất cả nhân viên' }, { key: 'review', text: 'Cần xác minh' }, { key: 'late', text: 'Đi muộn' }];
  return <section className="panel daily-attendance">
    <div className="daily-top"><div className="sub-tabs" role="group" aria-label="Trạng thái chấm công">{tabs.map((item) => <button key={item.key} className={tab === item.key ? 'active' : ''} aria-pressed={tab === item.key} onClick={() => { setTab(item.key); setPage(1); }}>{item.text}</button>)}</div><Button variant="outlined" startIcon={<Download size={16}/>} disabled={!date || query.isLoading || query.isError || rows.length === 0} onClick={() => exportCsv(rows, date)}>Xuất CSV</Button></div>
    <div className="filters daily-filters">
      <FormField label="Tìm nhân viên" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc mã" slotProps={{ input: { startAdornment: <Search size={16}/> } }}/>
      <FormField select label="Cơ sở mặc định" value={facility} onChange={(e) => { setFacility(e.target.value); setPage(1); }}><option value="">Tất cả cơ sở</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}</FormField>
      <FormField type="date" label="Ngày chấm công" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }}/>
      <Button className="filter-reset" variant="contained" onClick={() => { setSearch(''); setFacility(''); setDate(initialDate); setTab('all'); setPage(1); }}>Bỏ lọc</Button>
    </div>
    <p className="read-note">Giờ vào/ra gồm lượt được ghi nhận và điều chỉnh đã duyệt. “Đi muộn” chỉ đối chiếu giờ vào đầu với giờ ca, chưa tính trừ công. Công thường chưa được tính tự động.</p>
    {!date ? <div className="empty-state">Chọn ngày để xem chấm công.</div> : query.isLoading ? <div className="empty-state" role="status">Đang tải dữ liệu chấm công…</div> : query.isError ? <div className="data-fallback"><Alert severity="error">Không tải được dữ liệu: {errorMessage(query.error)}</Alert><Button variant="outlined" onClick={() => void query.refetch()}>Thử lại</Button></div> : <>
      <div className="table-toolbar"><span><strong>{rows.length}</strong> nhân viên · {shortDate(date)}</span><Button onClick={() => void query.refetch()} disabled={query.isFetching} startIcon={<RefreshCw size={14}/>}>Làm mới</Button></div>
      <div className="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Cơ sở cuối</th><th>Vào đầu / Ra cuối</th><th>Trạng thái</th><th>Công thường</th><th>Chi tiết</th></tr></thead><tbody>{rows.slice((visiblePage - 1) * 15, visiblePage * 15).map((row) => <tr key={row.employee.id}>
        <td><div className="table-person"><span className="table-avatar">{row.employee.employee_code.slice(-2)}</span><div><strong>{row.employee.full_name}</strong><small>{row.employee.employee_code}</small></div></div></td><td>{row.lastFacility}</td><td className="mono">{row.first ? vietnamTime(row.first.time) : '—'} / {row.last?.type === 'OUT' ? vietnamTime(row.last.time) : '—'}</td><td><span className={`pill ${row.review ? 'amber' : row.first ? 'green' : 'neutral'}`}>{row.reason}</span>{row.late && <small className="block">Vào sau giờ ca</small>}</td><td>Chưa tính</td><td><Button size="small" variant="outlined" aria-label={`Xem chấm công của ${row.employee.full_name}`} onClick={() => setSelected(row.employee)}>Xem chi tiết</Button></td>
      </tr>)}</tbody></table></div>
      {!rows.length && <div className="empty-state"><strong>Không có nhân viên phù hợp</strong><span>Thử đổi bộ lọc hoặc ngày.</span></div>}
      <div className="table-footer"><span>Trang {visiblePage} / {pageCount}</span><Pagination size="small" page={visiblePage} count={pageCount} onChange={(_, value) => setPage(value)} color="primary"/></div>
    </>}
    {selected && <EmployeeAttendanceDialog employee={selected} initialDate={date} onClose={() => setSelected(null)}/>}
  </section>;
}
