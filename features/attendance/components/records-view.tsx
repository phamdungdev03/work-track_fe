"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { FormField } from "@/components/ui/form-field";
import { EmployeeSelect } from "./employee-select";
import { useState, type FC, type ReactNode } from "react";
import {
  Alert,
  Pagination,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMuiSnackbar } from "@/hooks/use-mui-snackbar";
import { errorMessage } from "@/lib/api-client";
import { ClipboardList, RefreshCw, Search, Plus } from "lucide-react";
import SupportForm from "./support-form";
import { EmployeeAttendanceDialog } from "./employee-attendance-dialog";
import { useDefaultSchedules } from "../hooks/use-default-schedules";
import { QueryBoundary } from "@/components/query-boundary";
import { attendanceApi } from "../api/attendance-api";
import { label, shortDate, vietnamTime, vietnamDate } from "../helpers/format";
import type {
  AttendanceRequest,
  Employee,
  Facility,
  HrAlert,
  Page,
  Params,
  Scan,
  Schedule,
  Support,
  View,
  SupportFormAction,
} from "../types";

type Column<T> = { title: string; render: (row: T) => ReactNode };
export const Status: FC<{ value: string }> = ({ value }) => (
  <span
    className={`pill ${["ACCEPTED", "ACTIVE", "VERIFIED", "APPROVED", "CONFIRMED"].includes(value) ? "green" : ["REJECTED", "INACTIVE", "CANCELLED"].includes(value) ? "red" : ["OPEN", "PENDING", "IGNORED", "PENDING_REVIEW"].includes(value) ? "amber" : "neutral"}`}
  >
    {label(value)}
  </span>
);

function RecordTable<T extends { id: number }>({
  resource,
  params,
  load,
  columns,
  page,
  setPage,
}: {
  resource: string;
  params: Params;
  load: (params: Params) => Promise<Page<T>>;
  columns: Column<T>[];
  page: number;
  setPage: (page: number) => void;
}) {
  const { data, error, isFetching, refetch } = useSuspenseQuery({
    queryKey: [resource, "table", params, page],
    queryFn: () => load({ ...params, page, page_size: 15 }),
    refetchInterval: 30000,
  });
  return (
    <>
      {error && (
        <Alert severity="warning">
          Không cập nhật được dữ liệu mới. Đang hiển thị lần tải gần nhất.
        </Alert>
      )}
      <div className="table-toolbar">
        <span>
          <strong>{data.count}</strong> bản ghi phù hợp
        </span>
        <Button
          onClick={() => void refetch()}
          disabled={isFetching}
          startIcon={<RefreshCw size={14} />}
        >
          Làm mới
        </Button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.title}>{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.results.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.title}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.results.length === 0 && (
        <div className="empty-state">
          <ClipboardList size={30} />
          <strong>Chưa có dữ liệu phù hợp</strong>
          <span>Thử đổi ngày, nhân viên hoặc bộ lọc.</span>
        </div>
      )}
      <div className="table-footer">
        <span>
          Trang {page} / {Math.max(1, Math.ceil(data.count / 15))}
        </span>
        <Pagination
          size="small"
          page={page}
          count={Math.max(1, Math.ceil(data.count / 15))}
          onChange={(_, value) => setPage(value)}
          color="primary"
        />
      </div>
    </>
  );
}

interface Props {
  view: Exclude<View, "scan" | "daily">;
  employees: Employee[];
  facilities: Facility[];
  initialDate: string;
}
const RecordsView: FC<Props> = ({
  view,
  employees,
  facilities,
  initialDate,
}) => {
  const [date, setDate] = useState(initialDate);
  const scheduleSetup = useDefaultSchedules(view === "schedules" ? date : "");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [facility, setFacility] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [scheduleTab, setScheduleTab] = useState<"schedules" | "support">(
    "schedules",
  );
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [supportForm, setSupportForm] = useState<SupportFormAction | null>(null);
  const [review, setReview] = useState<{ kind: 'alert'; item: HrAlert } | { kind: 'request'; item: AttendanceRequest; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const queryClient = useQueryClient();
  const notify = useMuiSnackbar();
  const mutation = useMutation({
    mutationFn: async (action: NonNullable<typeof review>): Promise<void> => {
      if (action.kind === 'alert') await attendanceApi.verifyAlert(action.item.id, reviewNote.trim(), action.item.last_seen_at);
      else await attendanceApi.reviewRequest(action.item.id, action.decision, reviewNote.trim(), action.item.version);
    },
    onSuccess: () => {
      const message = review?.kind === 'alert' ? 'Đã xác minh cảnh báo.' : review?.decision === 'APPROVED' ? 'Đã duyệt yêu cầu.' : 'Đã từ chối yêu cầu.';
      setReview(null); setReviewNote(''); setReviewError(''); notify(message, 'success');
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
      void queryClient.invalidateQueries({ queryKey: ['scans'] });
      void queryClient.invalidateQueries({ queryKey: ['daily-attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['monthly-attendance'] });
    },
    onError: (error) => { setReviewError(errorMessage(error)); void queryClient.invalidateQueries({ queryKey: [review?.kind === 'alert' ? 'alerts' : 'requests'] }); },
  });
  const openReview = (action: NonNullable<typeof review>) => { setReviewNote(''); setReviewError(''); setReview(action); };

  const params: Params = {
    date: date || undefined,
    employee_id: employee?.id,
    facility_id: facility || undefined,
    ...(view === "history"
      ? { outcome: status || undefined }
      : { status: status || undefined }),
  };
  const employeeName = (id: number | null): ReactNode => {
    const item = employees.find((e) => e.id === id);
    return (
      <div className="table-person">
        <span className="table-avatar">
          {item?.employee_code.slice(-2) ?? "?"}
        </span>
        <div>
          <strong>{item?.full_name ?? "Chưa nhận diện"}</strong>
          <small>{item?.employee_code ?? "—"}</small>
        </div>
      </div>
    );
  };
  const facilityName = (id: number | null): string =>
    facilities.find((f) => f.id === id)?.name ?? "—";
  const scanColumns: Column<Scan>[] = [
    { title: "Nhân viên", render: (r) => employeeName(r.employee_id) },
    {
      title: "Thời điểm",
      render: (r) => (
        <>
          <strong className="mono">{vietnamTime(r.occurred_at)}</strong>
          <small className="block">
            {shortDate(vietnamDate(Date.parse(r.occurred_at)))}
          </small>
        </>
      ),
    },
    { title: "Cơ sở", render: (r) => r.facility_name },
    {
      title: "Vào / Ra",
      render: (r) =>
        r.event_type ? (
          <span className={`direction ${r.event_type.toLowerCase()}`}>
            {r.event_type === "IN" ? "↓" : "↑"} {label(r.event_type)}
          </span>
        ) : (
          "—"
        ),
    },
    { title: "Kết quả", render: (r) => <Status value={r.outcome} /> },
    {
      title: "Ghi chú",
      render: (r) => (
        <span className="table-note">
          {r.decision_snapshot.message ?? label(r.reason_code)}
        </span>
      ),
    },
  ];
  const scheduleColumns: Column<Schedule>[] = [
    { title: "Nhân viên", render: (r) => employeeName(r.employee) },
    { title: "Ngày làm việc", render: (r) => shortDate(r.work_date) },
    { title: "Cơ sở quản lý", render: (r) => facilityName(r.owner_facility) },
    {
      title: "Ca làm",
      render: (r) =>
        `${vietnamTime(r.starts_at).slice(0, 5)} – ${vietnamTime(r.ends_at).slice(0, 5)}`,
    },
    {
      title: "Công chuẩn / Nghỉ",
      render: (r) =>
        `${r.standard_work_minutes / 60} giờ / ${r.unpaid_break_minutes} phút`,
    },
    {
      title: "Trạng thái",
      render: (r) => (
        <>
          <Status value={r.status} />
          {r.locked_at && <small className="block">Đã khóa công</small>}
        </>
      ),
    },
  ];
  const alertColumns: Column<HrAlert>[] = [
    { title: "Nhân viên", render: (r) => employeeName(r.employee) },
    { title: "Ngày", render: (r) => shortDate(r.work_date) },
    { title: "Cơ sở", render: (r) => facilityName(r.facility) },
    {
      title: "Cần xác minh",
      render: (r) => <span className="table-note">{label(r.alert_type)}</span>,
    },
    { title: "Trạng thái", render: (r) => <Status value={r.status} /> },
    {
      title: "Kết luận HR",
      render: (r) => (
        <span className="table-note">
          {r.review_note ?? "Chưa có kết luận"}
        </span>
      ),
    },
    { title: "Thao tác", render: (r) => <div className="support-actions">{r.status === 'OPEN' && <Button size="small" variant="outlined" onClick={() => openReview({ kind: 'alert', item: r })}>Xác minh</Button>}<Button size="small" onClick={() => setSupportForm({ mode: 'create', employeeId: r.employee, date: r.work_date, targetFacility: r.facility, fromAlert: true })}>Tạo phân công</Button></div> },
  ];
  const requestColumns: Column<AttendanceRequest>[] = [
    { title: "Nhân viên", render: (r) => employeeName(r.employee) },
    { title: "Yêu cầu", render: (r) => label(r.request_type) },
    {
      title: "Đề xuất",
      render: (r) => (
        <>
          {r.proposed_event_type ? label(r.proposed_event_type) : "—"}{" "}
          {r.proposed_occurred_at ? vietnamTime(r.proposed_occurred_at) : ""}
          <small className="block">{facilityName(r.proposed_facility)}</small>
        </>
      ),
    },
    {
      title: "Lý do",
      render: (r) => <span className="table-note">{r.reason}</span>,
    },
    { title: "Trạng thái", render: (r) => <Status value={r.status} /> },
    {
      title: "Phản hồi",
      render: (r) => (
        <span className="table-note">
          {r.review_note ?? "Chưa có phản hồi"}
        </span>
      ),
    },
    { title: "Thao tác", render: (r) => r.status === 'PENDING' ? <div className="review-actions"><Button size="small" variant="outlined" onClick={() => openReview({ kind: 'request', item: r, decision: 'APPROVED' })}>Duyệt</Button><Button size="small" color="error" onClick={() => openReview({ kind: 'request', item: r, decision: 'REJECTED' })}>Từ chối</Button></div> : '—' },
  ];
  const statuses =
    view === "history"
      ? ["ACCEPTED", "IGNORED", "REJECTED", "PENDING_REVIEW"]
      : view === "alerts"
        ? ["OPEN", "VERIFIED"]
        : view === "requests"
          ? ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]
          : view === "employees"
            ? ["ACTIVE", "INACTIVE"]
            : scheduleTab === "support"
              ? ["PLANNED", "CONFIRMED", "CANCELLED"]
              : ["SCHEDULED", "CANCELLED"];
  const filteredEmployees = employees.filter(
    (e) =>
      (!facility || e.home_facility_id === Number(facility)) &&
      (!status || e.status === status) &&
      `${e.employee_code} ${e.full_name}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  return (
    <section className="panel records-panel">
      {scheduleSetup.error && <Alert severity="warning" action={<Button onClick={scheduleSetup.retry}>Thử lại</Button>}>Không thể tạo ca mặc định cho ngày đã chọn.</Alert>}
      {view === "schedules" && (
        <div className="sub-tabs">
          <button
            className={scheduleTab === "schedules" ? "active" : ""}
            onClick={() => {
              setScheduleTab("schedules");
              setStatus("");
              setPage(1);
            }}
          >
            Lịch ca
          </button>
          <button
            className={scheduleTab === "support" ? "active" : ""}
            onClick={() => {
              setScheduleTab("support");
              setStatus("");
              setPage(1);
            }}
          >
            Phân công support
          </button>
        </div>
      )}
      {view === 'schedules' && scheduleTab === 'support' && <div className="support-create-bar"><p>Phân công nhân viên hỗ trợ cơ sở khác trong ca làm việc.</p><Button variant="contained" startIcon={<Plus size={17}/>} onClick={() => setSupportForm({ mode: 'create', employeeId: employee?.id, date: date || initialDate })}>Tạo phân công support</Button></div>}
      <div className="filters">
        {view === "employees" ? (
          <FormField
            label="Tìm nhân viên"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            slotProps={{
              input: {
                startAdornment: <Search size={16} style={{ marginRight: 8 }} />,
              },
            }}
          />
        ) : (
          <>
            <FormField
              label="Ngày làm việc"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <EmployeeSelect
              employees={employees}
              value={employee}
              placeholder="Tất cả nhân viên"
              onChange={(value) => { setEmployee(value); setPage(1); }}
            />
          </>
        )}
        <FormField
          select
          label="Cơ sở"
          value={facility}
          onChange={(e) => {
            setFacility(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả cơ sở</option>
          {facilities.map((f) => (
            <option value={f.id} key={f.id}>
              {f.code} · {f.name}
            </option>
          ))}
        </FormField>
        <FormField
          select
          label="Trạng thái"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {statuses.map((s) => (
            <option value={s} key={s}>
              {label(s)}
            </option>
          ))}
        </FormField>
        {view !== "employees" && (
          <Button
            variant="contained"
            className="filter-reset"
            onClick={() => {
              setDate("");
              setEmployee(null);
              setFacility("");
              setStatus("");
              setPage(1);
            }}
          >
            Bỏ lọc
          </Button>
        )}
      </div>
      {(view === "alerts" || view === "requests") && <div className="read-note">Thao tác HR mô phỏng được lưu vào nhật ký. Lượt chấm gốc vẫn được giữ nguyên.</div>}
      <QueryBoundary
        compact
        key={`${view}-${scheduleTab}-${JSON.stringify(params)}-${page}`}
      >
        {view === "history" && (
          <RecordTable
            resource="scans"
            params={params}
            load={attendanceApi.scans}
            columns={scanColumns}
            page={page}
            setPage={setPage}
          />
        )}
        {view === "schedules" && scheduleTab === "schedules" && (
          scheduleSetup.pending ? <div className="empty-state" role="status">Đang chuẩn bị lịch ca…</div> : <RecordTable
            resource="schedules"
            params={params}
            load={attendanceApi.schedules}
            columns={scheduleColumns}
            page={page}
            setPage={setPage}
          />
        )}
        {view === "schedules" && scheduleTab === "support" && (
          scheduleSetup.pending ? <div className="empty-state" role="status">Đang chuẩn bị lịch ca…</div> : <SupportTable
            params={params}
            page={page}
            setPage={setPage}
            employeeName={employeeName}
            facilityName={facilityName}
            onAction={(mode, assignment, schedule) => setSupportForm({ mode, assignment, employeeId: schedule.employee, date: schedule.work_date })}
          />
        )}
        {view === "alerts" && (
          <RecordTable
            resource="alerts"
            params={params}
            load={attendanceApi.alerts}
            columns={alertColumns}
            page={page}
            setPage={setPage}
          />
        )}
        {view === "requests" && (
          <RecordTable
            resource="requests"
            params={params}
            load={attendanceApi.requests}
            columns={requestColumns}
            page={page}
            setPage={setPage}
          />
        )}
        {view === "employees" && (
          <>
            <div className="table-toolbar">
              <span>
                <strong>{filteredEmployees.length}</strong> nhân viên
              </span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Cơ sở mặc định</th>
                    <th>Ngày vào làm</th>
                    <th>Trạng thái</th>
                    <th>Chấm công</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees
                    .slice((page - 1) * 15, page * 15)
                    .map((e) => (
                      <tr key={e.id}>
                        <td>{employeeName(e.id)}</td>
                        <td>{e.home_facility_name}</td>
                        <td>{shortDate(e.hired_on)}</td>
                        <td>
                          <Status value={e.status} />
                        </td>
                        <td><Button size="small" variant="outlined" aria-label={`Xem chấm công của ${e.full_name}`} onClick={() => setSelectedEmployee(e)}>Xem chấm công</Button></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!filteredEmployees.length && (
              <div className="empty-state">
                Không tìm thấy nhân viên phù hợp.
              </div>
            )}
            <div className="table-footer">
              <span>Trang {page}</span>
              <Pagination
                count={Math.max(1, Math.ceil(filteredEmployees.length / 15))}
                page={page}
                onChange={(_, value) => setPage(value)}
              />
            </div>
          </>
        )}
      </QueryBoundary>
      {selectedEmployee && <EmployeeAttendanceDialog employee={selectedEmployee} initialDate={initialDate} onClose={() => setSelectedEmployee(null)} />}
      {supportForm && <SupportForm action={supportForm} employees={employees} facilities={facilities} onClose={() => setSupportForm(null)}/>}
      <Dialog open={!!review} onClose={() => { if (!mutation.isPending) setReview(null); }} aria-labelledby="review-title" fullWidth maxWidth="sm">
        <DialogTitle id="review-title">{review?.kind === 'alert' ? 'Xác minh cảnh báo support' : review?.decision === 'APPROVED' ? 'Duyệt giải trình' : 'Từ chối giải trình'}</DialogTitle>
        <DialogContent dividers>
          {review && <div className="review-dialog-content">
            <p><strong>Nhân viên:</strong> {employees.find((item) => item.id === review.item.employee)?.full_name ?? '—'}</p>
            {review.kind === 'alert' ? <><p><strong>Cơ sở:</strong> {facilityName(review.item.facility)} · <strong>Ngày:</strong> {shortDate(review.item.work_date)}</p><p>{label(review.item.alert_type)}</p><QueryBoundary compact><AlertEvidence alert={review.item}/></QueryBoundary></> : <><p><strong>Yêu cầu:</strong> {label(review.item.request_type)}</p><p><strong>Lý do:</strong> {review.item.reason}</p><p><strong>Đề xuất:</strong> {review.item.proposed_event_type ? label(review.item.proposed_event_type) : '—'} {review.item.proposed_occurred_at ? `${vietnamTime(review.item.proposed_occurred_at)} · ${shortDate(vietnamDate(Date.parse(review.item.proposed_occurred_at)))}` : ''} · {facilityName(review.item.proposed_facility)}</p></>}
            <FormField autoFocus fullWidth multiline minRows={3} required label="Ghi chú xác minh" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} slotProps={{ htmlInput: { maxLength: 1000 } }} helperText="Ghi lại kết quả kiểm tra hoặc lý do để lưu nhật ký." />
            {reviewError && <Alert severity="error">{reviewError}</Alert>}
            {review?.kind === 'request' && review.decision === 'APPROVED' && <p className="subtle">Yêu cầu được duyệt sẽ tham gia tính công; lượt quét gốc không bị sửa.</p>}
          </div>}
        </DialogContent>
        <DialogActions><Button disabled={mutation.isPending} onClick={() => setReview(null)}>Hủy</Button><Button disabled={!reviewNote.trim() || mutation.isPending} variant="contained" color={review?.kind === 'request' && review.decision === 'REJECTED' ? 'error' : 'primary'} onClick={() => { if (review) mutation.mutate(review); }}>{mutation.isPending ? 'Đang lưu…' : review?.kind === 'alert' ? 'Xác nhận đã xác minh' : review?.decision === 'APPROVED' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}</Button></DialogActions>
      </Dialog>
    </section>
  );
};

const AlertEvidence: FC<{ alert: HrAlert }> = ({ alert }) => {
  const { data } = useSuspenseQuery({ queryKey: ['scans', 'alert-evidence', alert.id, alert.last_seen_at], queryFn: () => attendanceApi.alertScans(alert.id) });
  return <div className="review-evidence"><strong>Lượt liên quan ({data.length})</strong>{data.length ? data.map((scan) => <p key={scan.id}>{vietnamTime(scan.occurred_at)} · {scan.event_type ? label(scan.event_type) : label(scan.outcome)} · {scan.facility_name}</p>) : <p>Không tìm thấy lượt liên kết.</p>}</div>;
};

const SupportTable: FC<{
  params: Params;
  page: number;
  setPage: (page: number) => void;
  employeeName: (id: number | null) => ReactNode;
  facilityName: (id: number | null) => string;
  onAction: (mode: 'edit' | 'cancel', item: Support, schedule: Schedule) => void;
}> = ({ params, page, setPage, employeeName, facilityName, onAction }) => {
  const { data: schedules } = useSuspenseQuery({
    queryKey: ["schedules", "lookup"],
    queryFn: attendanceApi.allSchedules,
  });
  const columns: Column<Support>[] = [
    {
      title: "Nhân viên",
      render: (r) =>
        employeeName(
          schedules.find((s) => s.id === r.schedule)?.employee ?? null,
        ),
    },
    {
      title: "Điều động",
      render: (r) => (
        <>
          {facilityName(r.from_facility)}
          <small className="block">→ {facilityName(r.to_facility)}</small>
        </>
      ),
    },
    {
      title: "Thời gian support",
      render: (r) => (
        <>
          {vietnamTime(r.depart_at).slice(0, 5)} →{" "}
          {vietnamTime(r.support_ends_at).slice(0, 5)}
          <small className="block">
            {shortDate(vietnamDate(Date.parse(r.depart_at)))}
          </small>
        </>
      ),
    },
    { title: "Lý do", render: (r) => r.reason },
    { title: "Trạng thái", render: (r) => <Status value={r.status} /> },
    { title: "Thao tác", render: (r) => {
      const schedule = schedules.find((item) => item.id === r.schedule);
      return r.status !== 'CANCELLED' && schedule ? <div className="support-actions"><Button size="small" onClick={() => onAction('edit', r, schedule)}>Sửa</Button><Button size="small" color="error" onClick={() => onAction('cancel', r, schedule)}>Hủy</Button></div> : '—';
    } },
  ];
  return (
    <RecordTable
      resource="support"
      params={params}
      page={page}
      setPage={setPage}
      load={attendanceApi.support}
      columns={columns}
    />
  );
};
export default RecordsView;
