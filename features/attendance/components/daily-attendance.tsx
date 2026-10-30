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
import type { Employee, Facility, WorkDay } from '../types';
import { EmployeeAttendanceDialog } from './employee-attendance-dialog';
import { useDefaultSchedules } from '../hooks/use-default-schedules';
import { AddEventDialog } from './add-event-dialog';

type Row = { employee: Employee; day?: WorkDay; lastFacility: string };
type Tab = 'all' | 'review' | 'late';
const hours = (value: number | null | undefined) => value == null ? 'Chưa tính' : `${Math.floor(value / 60)} giờ ${value % 60} phút`;
function csvCell(value: string): string {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
function exportCsv(rows: Row[], date: string) {
  const data = [['Mã nhân viên', 'Nhân viên', 'Cơ sở cuối', 'Vào đầu', 'Ra cuối', 'Trạng thái', 'Công thường'], ...rows.map(({ employee, day, lastFacility }) => [employee.employee_code, employee.full_name, lastFacility, day?.first_in ? vietnamTime(day.first_in) : '', day?.last_out ? vietnamTime(day.last_out) : '', day?.reasons.join('; ') || day?.status || 'Chưa có lượt', hours(day?.work_minutes)])];
  const blob = new Blob(['\ufeff', data.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `cham-cong-${date}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DailyAttendance({ employees, facilities, initialDate, now }: { employees: Employee[]; facilities: Facility[]; initialDate: string; now: number }) {
  const [date, setDate] = useState(initialDate);
  const scheduleSetup = useDefaultSchedules(date);
  const [month, setMonth] = useState(initialDate.slice(0, 7));
  const [search, setSearch] = useState('');
  const [facility, setFacility] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [requestEmployee, setRequestEmployee] = useState<Employee | null>(null);
  const [showMonth, setShowMonth] = useState(false);
  const query = useQuery({ queryKey: ['daily-attendance', date], queryFn: () => attendanceApi.workDays(date, new Date(now).toISOString()), enabled: !!date && !scheduleSetup.pending, refetchInterval: 30000 });
  const monthly = useQuery({ queryKey: ['monthly-attendance', month], queryFn: () => attendanceApi.workMonths(month, new Date(now).toISOString()), enabled: showMonth && !!month, refetchInterval: 30000 });
  const rows = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLocaleLowerCase('vi');
    return employees.map((employee) => { const day = query.data.find((r) => r.employee_id === employee.id); return { employee, day, lastFacility: facilities.find((f) => f.id === day?.last_facility_id)?.name ?? '—' }; })
      .filter((row) => (!facility || row.employee.home_facility_id === Number(facility)) && (!term || `${row.employee.employee_code} ${row.employee.full_name}`.toLocaleLowerCase('vi').includes(term)) && (tab === 'all' || (tab === 'review' ? row.day?.needs_review : (row.day?.late_minutes ?? 0) > 0)));
  }, [query.data, employees, facilities, search, facility, tab]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 15)); const visiblePage = Math.min(page, pageCount);
  const tabs: { key: Tab; text: string }[] = [{ key: 'all', text: 'Tất cả nhân viên' }, { key: 'review', text: 'Cần xác minh' }, { key: 'late', text: 'Đi muộn' }];
  return <section className="panel daily-attendance">
    {scheduleSetup.error && <Alert severity="warning" action={<Button onClick={scheduleSetup.retry}>Thử lại</Button>}>Không thể tạo ca mặc định cho ngày đã chọn.</Alert>}
    <div className="daily-top"><div className="sub-tabs" role="group" aria-label="Trạng thái chấm công">{tabs.map((item) => <button key={item.key} className={!showMonth && tab === item.key ? 'active' : ''} aria-pressed={!showMonth && tab === item.key} onClick={() => { setShowMonth(false); setTab(item.key); setPage(1); }}>{item.text}</button>)}<button className={showMonth ? 'active' : ''} aria-pressed={showMonth} onClick={() => setShowMonth(true)}>Thống kê tháng</button></div>{!showMonth && <Button variant="outlined" startIcon={<Download size={16}/>} disabled={!date || query.isLoading || query.isError || rows.length === 0} onClick={() => exportCsv(rows, date)}>Xuất CSV</Button>}</div>
    {showMonth ? <><div className="filters daily-filters"><FormField type="month" label="Tháng thống kê" value={month} onChange={(e) => setMonth(e.target.value)}/></div><p className="read-note">Mỗi ngày tối đa một lần đi muộn và một lần về sớm. Ngày chưa đủ lượt không được tính vào số lần.</p>
      {!month ? <div className="empty-state">Chọn tháng để xem thống kê.</div> : monthly.isLoading ? <div className="empty-state">Đang tải thống kê…</div> : monthly.isError ? <Alert severity="error">{errorMessage(monthly.error)}</Alert> : <div className="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Đi muộn</th><th>Về sớm</th><th>Ngày chưa đủ dữ liệu</th></tr></thead><tbody>{employees.map((employee) => { const row = monthly.data?.find((item) => item.employee_id === employee.id); return <tr key={employee.id}><td>{employee.employee_code} · {employee.full_name}</td><td>{row?.late_count ?? 0} lần</td><td>{row?.early_count ?? 0} lần</td><td>{row?.incomplete_count ?? 0} ngày</td></tr>; })}</tbody></table></div>}</> : <>
      <div className="filters daily-filters"><FormField label="Tìm nhân viên" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tên hoặc mã" slotProps={{ input: { startAdornment: <Search size={16}/> } }}/><FormField select label="Cơ sở mặc định" value={facility} onChange={(e) => { setFacility(e.target.value); setPage(1); }}><option value="">Tất cả cơ sở</option>{facilities.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}</FormField><FormField type="date" label="Ngày chấm công" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }}/><Button className="filter-reset" variant="contained" onClick={() => { setSearch(''); setFacility(''); setDate(initialDate); setTab('all'); setPage(1); }}>Bỏ lọc</Button></div>
      <p className="read-note">Công = 8 giờ trừ số phút đi muộn và về sớm; không tính riêng thời gian giữa các lượt. Ngày thiếu lượt cần giải trình.</p>
      {!date ? <div className="empty-state">Chọn ngày để xem chấm công.</div> : scheduleSetup.pending || query.isLoading ? <div className="empty-state" role="status">Đang tải dữ liệu chấm công…</div> : query.isError ? <div className="data-fallback"><Alert severity="error">Không tải được dữ liệu: {errorMessage(query.error)}</Alert><Button variant="outlined" onClick={() => void query.refetch()}>Thử lại</Button></div> : <><div className="table-toolbar"><span><strong>{rows.length}</strong> nhân viên · {shortDate(date)}</span><Button onClick={() => void query.refetch()} disabled={query.isFetching} startIcon={<RefreshCw size={14}/>}>Làm mới</Button></div><div className="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Cơ sở cuối</th><th>Vào đầu / Ra cuối</th><th>Trạng thái</th><th>Công thường</th><th>Thao tác</th></tr></thead><tbody>{rows.slice((visiblePage - 1) * 15, visiblePage * 15).map(({ employee, day, lastFacility }) => <tr key={employee.id}><td><div className="table-person"><span className="table-avatar">{employee.employee_code.slice(-2)}</span><div><strong>{employee.full_name}</strong><small>{employee.employee_code}</small></div></div></td><td>{lastFacility}</td><td className="mono">{day?.first_in ? vietnamTime(day.first_in) : '—'} / {day?.last_out ? vietnamTime(day.last_out) : '—'}</td><td><span className={`pill ${day?.needs_review ? 'amber' : day?.work_minutes != null ? 'green' : 'neutral'}`}>{day?.status ?? 'Chưa có lượt'}</span>{day?.reasons.map((reason) => <small className="block" key={reason}>{reason}</small>)}{(day?.late_minutes ?? 0) > 0 && <small className="block">Muộn {day?.late_minutes} phút</small>}{(day?.early_minutes ?? 0) > 0 && <small className="block">Sớm {day?.early_minutes} phút</small>}</td><td>{hours(day?.work_minutes)}</td><td><Button size="small" variant="outlined" aria-label={`Xem chấm công của ${employee.full_name}`} onClick={() => setSelected(employee)}>Xem chi tiết</Button> <Button size="small" variant="outlined" onClick={() => setRequestEmployee(employee)}>Giải trình</Button></td></tr>)}</tbody></table></div>{!rows.length && <div className="empty-state"><strong>Không có nhân viên phù hợp</strong><span>Thử đổi bộ lọc hoặc ngày.</span></div>}<div className="table-footer"><span>Trang {visiblePage} / {pageCount}</span><Pagination size="small" page={visiblePage} count={pageCount} onChange={(_, value) => setPage(value)} color="primary"/></div></>}
    </>}
    {selected && <EmployeeAttendanceDialog employee={selected} initialDate={date} onClose={() => setSelected(null)}/>}{requestEmployee && <AddEventDialog employee={requestEmployee} date={date} facilities={facilities} onClose={() => setRequestEmployee(null)}/>}
  </section>;
}
