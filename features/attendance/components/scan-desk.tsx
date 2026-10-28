"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { FormField } from "@/components/ui/form-field";
import { EmployeeSelect } from "./employee-select";
import { useCallback, useRef, useState, type FC } from "react";
import {
  Alert,
  Slider,
  Switch,
} from "@mui/material";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  ScanFace,
  QrCode,
  Volume2,
  Clock3,
  RotateCcw,
  Check,
  ArrowUpRight,
  Radio,
  Wifi,
  RefreshCw,
} from "lucide-react";
import { attendanceApi } from "../api/attendance-api";
import {
  dateTimeInput,
  label,
  longDate,
  vietnamDate,
  vietnamTime,
} from "../helpers/format";
import { useScanAudio } from "../hooks/use-scan-audio";
import type { useDemoClock } from "../hooks/use-demo-clock";
import type {
  Employee,
  Facility,
  ScanPayload,
  ScanResult,
  QrScanPayload,
  PendingScan,
} from "../types";
import QrPanel from "./qr-panel";
import { errorMessage, isAmbiguousFailure } from "@/lib/api-client";
import { useMuiSnackbar } from "@/hooks/use-mui-snackbar";
import { QueryBoundary } from "@/components/query-boundary";

const STORAGE_KEY = "worktrack.pending-scan.v2";
const LEGACY_STORAGE_KEY = "worktrack.pending-scan.v1";
function loadPending(): PendingScan | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const legacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    const raw: unknown = JSON.parse(stored ?? legacy ?? "null");
    if (!raw || typeof raw !== "object") return null;
    const item = (
      "mode" in raw && "payload" in raw ? raw : { mode: "face", payload: raw }
    ) as PendingScan;
    if (
      !item.payload ||
      typeof item.payload.request_id !== "string" ||
      typeof item.payload.employee_id !== "number" ||
      typeof item.payload.facility_id !== "number"
    )
      return null;
    if (
      item.mode === "face" &&
      ["MATCH", "NO_FACE", "UNREGISTERED"].includes(item.payload.recognition)
    )
      return item;
    if (
      item.mode === "qr" &&
      typeof item.payload.qr_token === "string" &&
      ["IN_RANGE", "OUT_OF_RANGE", "UNAVAILABLE"].includes(
        item.payload.gps_status,
      )
    )
      return item;
  } catch {
    /* Storage unavailable: keep retries in memory for this page. */
  }
  return null;
}
function savePending(payload: PendingScan | null): void {
  try {
    if (payload) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    else sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* The request remains in React state. */
  }
}

const RecentScans: FC<{ employee: number; date: string }> = ({
  employee,
  date,
}) => {
  const { data, error, refetch } = useSuspenseQuery({
    queryKey: ["scans", "recent", employee, date],
    queryFn: () =>
      attendanceApi.scans({ employee_id: employee, date, page_size: 5 }),
    refetchInterval: 15000,
  });
  return (
    <div className="recent-list">
      {error && (
        <Alert
          severity="warning"
          action={<Button onClick={() => void refetch()}>Tải lại</Button>}
        >
          Chưa cập nhật được lịch sử.
        </Alert>
      )}
      {data.results.map((scan) => (
        <div className="recent-row" key={scan.id}>
          <span
            className={`event-dot ${scan.outcome === "ACCEPTED" ? (scan.event_type === "IN" ? "in" : "out") : "muted-dot"}`}
          >
            {scan.event_type === "IN"
              ? "↓"
              : scan.event_type === "OUT"
                ? "↑"
                : "−"}
          </span>
          <div>
            <strong>
              {scan.outcome === "ACCEPTED"
                ? `Chấm ${label(scan.event_type!).toLowerCase()}`
                : label(scan.outcome)}
            </strong>
            <small>
              {scan.facility_name} · {label(scan.reason_code)}
            </small>
          </div>
          <time>{vietnamTime(scan.occurred_at)}</time>
        </div>
      ))}
      {data.results.length === 0 && (
        <div className="empty-state small">
          <Clock3 size={26} />
          <strong>Chưa có lượt chấm trong ngày</strong>
          <span>Lượt mới sẽ xuất hiện sau khi quét.</span>
        </div>
      )}
      {data.count > 5 && (
        <p className="subtle">
          Hiển thị 5 / {data.count} lượt. Xem đầy đủ ở Lịch sử chấm công.
        </p>
      )}
    </div>
  );
};

interface Props {
  employees: Employee[];
  facilities: Facility[];
  clock: ReturnType<typeof useDemoClock>;
  active: boolean;
}
const ScanDesk: FC<Props> = ({ employees, facilities, clock, active }) => {
  const [pending, setPending] = useState<PendingScan | null>(loadPending);
  const [employeeId, setEmployeeId] = useState<number | null>(
    () =>
      pending?.payload.employee_id ??
      employees.find((item) => item.status === "ACTIVE")?.id ??
      null,
  );
  const [facilityId, setFacilityId] = useState<number | null>(
    () =>
      pending?.payload.facility_id ??
      facilities.find((item) => item.is_active)?.id ??
      null,
  );
  const [mode, setMode] = useState<"face" | "qr">(
    () => pending?.mode ?? "face",
  );
  const [captured, setCaptured] = useState(() =>
    pending?.mode === "qr" ? pending.payload.qr_token : "",
  );
  const [gps, setGps] = useState<QrScanPayload["gps_status"]>(() =>
    pending?.mode === "qr" ? pending.payload.gps_status : "IN_RANGE",
  );
  const [recognition, setRecognition] =
    useState<ScanPayload["recognition"]>("MATCH");
  const [draftTime, setDraftTime] = useState(() =>
    dateTimeInput(clock.readNow()),
  );
  const [result, setResult] = useState<ScanResult | null>(null);
  const [failure, setFailure] = useState("");
  const [uncertain, setUncertain] = useState(!!pending);
  const inFlight = useRef(false);
  const queryClient = useQueryClient();
  const notify = useMuiSnackbar();
  const audio = useScanAudio();
  const employee = employees.find((item) => item.id === employeeId) ?? null;
  const facility = facilities.find((item) => item.id === facilityId) ?? null;

  const mutation = useMutation({
    mutationFn: (request: PendingScan) =>
      request.mode === "qr"
        ? attendanceApi.scanQr(request.payload)
        : attendanceApi.scan(request.payload),
    retry: false,
    onSuccess: (response) => {
      savePending(null);
      setPending(null);
      setUncertain(false);
      setFailure("");
      setResult(response);
      audio.announce(response);
      void queryClient.invalidateQueries({ queryKey: ["scans"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["requests"] });
      void queryClient.invalidateQueries({ queryKey: ["daily-attendance"] });
    },
    onError: (error) => {
      const ambiguous = isAmbiguousFailure(error);
      setUncertain(ambiguous);
      setFailure(errorMessage(error));
      if (!ambiguous) {
        setPending(null);
        savePending(null);
      }
      audio.speak(
        ambiguous
          ? "Chưa xác định được kết quả. Vui lòng thử lại cùng lượt quét."
          : errorMessage(error),
        ambiguous ? "NETWORK" : "ERROR",
      );
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const submit = useCallback(() => {
    if (inFlight.current || !employeeId || !facilityId) return;
    audio.unlock();
    const base = {
      request_id: crypto.randomUUID(),
      employee_id: employeeId,
      facility_id: facilityId,
      ...(clock.demo
        ? { occurred_at: new Date(clock.readNow()).toISOString() }
        : {}),
    };
    const request: PendingScan =
      pending ??
      (mode === "qr"
        ? {
            mode: "qr",
            payload: { ...base, qr_token: captured, gps_status: gps },
          }
        : { mode: "face", payload: { ...base, recognition } });
    inFlight.current = true;
    setPending(request);
    savePending(request);
    setFailure("");
    mutation.mutate(request);
  }, [
    employeeId,
    facilityId,
    audio,
    pending,
    mode,
    captured,
    gps,
    recognition,
    clock,
    mutation,
  ]);
  const locked = mutation.isPending || uncertain;
  const applyClock = (): void => {
    if (clock.apply(draftTime))
      notify("Đồng hồ demo tiếp tục chạy từ mốc đã chọn.", "info");
    else notify("Ngày giờ chưa hợp lệ.", "error");
  };
  const scanClass = mutation.isPending
    ? "scanning"
    : failure || uncertain
      ? "not-recorded"
    : result?.scan.outcome === "ACCEPTED"
      ? "accepted"
      : result
        ? "not-recorded"
        : "";

  return (
    <>
      <div className="scan-interaction" data-submitting={mutation.isPending || undefined}>
      <div
        className="scan-mode-tabs"
        role="group"
        aria-label="Phương thức chấm công"
      >
        <button
          className={mode === "face" ? "active" : ""}
          disabled={locked}
          onClick={() => setMode("face")}
        >
          <ScanFace size={17} /> Quét mặt
        </button>
        <button
          className={mode === "qr" ? "active" : ""}
          disabled={locked}
          onClick={() => setMode("qr")}
        >
          <QrCode size={17} /> QR đi support
        </button>
      </div>
      <div className={`scan-grid ${mode === "qr" ? "qr-scan-grid" : ""}`}>
        <section
          className={`scanner ${scanClass}`}
          aria-label="Máy quét mặt mô phỏng"
        >
          <div className="scanner-top">
            <span>
              <Radio size={14} /> Máy chấm công
            </span>
            <span className="scanner-site">{facility?.code ?? "—"}</span>
          </div>
          <div className="scanner-clock" aria-label="Đồng hồ chấm công">
            {vietnamTime(clock.now)}
          </div>
          <div className="scanner-date">{longDate(clock.now)}</div>
          <div className="face-stage">
            <div className="face-grid" />
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            {mode === "qr" ? (
              <QrCode size={130} strokeWidth={0.8} />
            ) : (
              <ScanFace size={145} strokeWidth={0.8} />
            )}
            <div className="scan-beam" />
            <span className="scan-tag">
              <span className="live-dot" />
              {mutation.isPending
                ? "Đang ghi nhận"
                : mode === "qr"
                  ? "Sẵn sàng quét QR"
                  : "Sẵn sàng nhận diện"}
            </span>
          </div>
          <div className="scanner-person" aria-live="polite" aria-atomic="true">
            <strong>
              {mutation.isPending ? "Đang ghi nhận lượt chấm…" : failure ? (uncertain ? "Chưa xác định được kết quả" : failure) : result ? result.message : employee?.full_name ?? "Chọn nhân viên để bắt đầu"}
            </strong>
            <span>
              {result && !mutation.isPending && !failure
                ? <>{result.scan.decision_snapshot.employee_name ?? result.scan.employee_name} <i>·</i> {result.scan.facility_name}</>
                : <>{employee?.employee_code ?? "—"} <i>·</i> {facility?.name ?? "Chọn cơ sở"}</>}
            </span>
          </div>
          <Button
            className="scan-button"
            variant="contained"
            fullWidth
            onClick={submit}
            disabled={mutation.isPending || !employee || !facility}
            startIcon={
              uncertain ? (
                <RefreshCw size={19} />
              ) : mode === "qr" ? (
                <QrCode size={20} />
              ) : (
                <ScanFace size={20} />
              )
            }
          >
            {mutation.isPending
              ? "Đang gửi lượt quét…"
              : uncertain
                ? "Thử lại cùng lượt quét"
                : mode === "qr"
                  ? "Chấm công bằng QR"
                  : "Quét chấm công"}
          </Button>
          <p className="scanner-hint">
            Tự xác định vào / ra · Không cần xác nhận
          </p>
          <div className="scanner-foot">
            <Wifi size={13} />
            <span>
              {mode === "qr"
                ? "Mô phỏng đọc QR / vị trí"
                : "Mô phỏng nhận diện"}{" "}
              · Ghi dữ liệu qua API
            </span>
          </div>
        </section>

        <section className="panel scan-controls">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Thông tin lượt quét</span>
              <h2>Thiết lập demo</h2>
            </div>
            <span className="pill neutral">Có thể thay đổi</span>
          </div>
          <div className="form-body">
            <EmployeeSelect
              employees={employees}
              value={employee}
              disabled={locked}
              onChange={(value) => setEmployeeId(value?.id ?? null)}
            />
            <div className="two-fields">
              <FormField
                select
                label="Cơ sở chấm công"
                value={facilityId ?? ""}
                disabled={locked}
                onChange={(event) => setFacilityId(Number(event.target.value))}
              >
                {facilities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </FormField>
              {mode === "face" && (
                <FormField
                  select
                  label="Kết quả nhận diện"
                  value={recognition}
                  disabled={locked}
                  onChange={(event) =>
                    setRecognition(
                      event.target.value as ScanPayload["recognition"],
                    )
                  }
                >
                  <option value="MATCH">Nhận diện thành công</option>
                  <option value="NO_FACE">Không thấy khuôn mặt</option>
                  <option value="UNREGISTERED">Mặt chưa đăng ký</option>
                </FormField>
              )}
            </div>
            {mode === "qr" && (
              <QrPanel
                active={active}
                facilityId={facilityId}
                facilityName={facility?.name ?? "Chưa chọn cơ sở"}
                captured={captured}
                setCaptured={setCaptured}
                gps={gps}
                setGps={setGps}
                disabled={locked}
              />
            )}
            <div className="clock-box">
              <div className="clock-heading">
                <span>
                  <Clock3 size={16} /> Thời gian chấm công
                </span>
                <span className={`pill ${clock.demo ? "amber" : "green"}`}>
                  {clock.demo ? "Giờ demo đang chạy" : "Giờ hiện tại"}
                </span>
              </div>
              <div className="clock-input">
                <FormField
                  label="Mốc giờ demo (Việt Nam)"
                  type="datetime-local"
                  value={draftTime}
                  disabled={locked}
                  onChange={(event) => setDraftTime(event.target.value)}
                  slotProps={{
                    inputLabel: { shrink: true },
                    htmlInput: { step: 1 },
                  }}
                />
                <Button
                  variant="outlined"
                  disabled={locked}
                  onClick={applyClock}
                >
                  Áp dụng
                </Button>
              </div>
              <div className="clock-caption">
                <span></span>
                <button
                  className="text-button"
                  disabled={locked}
                  onClick={() => {
                    clock.reset();
                    setDraftTime(dateTimeInput(Date.now()));
                  }}
                >
                  <RotateCcw size={12} /> Về giờ hiện tại
                </button>
              </div>
            </div>
            <div className="rule-line">
              <span className="rule-icon">
                <Check size={16} />
              </span>
              <div>
                <strong>
                  Cách nhau tối thiểu{" "}
                  {facility?.min_scan_interval_seconds ?? "—"} giây
                </strong>
                <p>Lượt bị bỏ qua không làm đổi trạng thái vào / ra.</p>
              </div>
            </div>
          </div>
          <div className="audio-controls">
            <div className="audio-heading">
              <Volume2 size={17} />
              <span>Đọc kết quả</span>
              <Switch
                size="small"
                checked={audio.enabled}
                onChange={(_, value) => audio.setEnabled(value)}
                slotProps={{ input: { "aria-label": "Bật âm thanh" } }}
              />
            </div>
            <div className="audio-adjust">
              <Slider
                aria-label="Âm lượng"
                value={audio.volume}
                onChange={(_, value) => audio.setVolume(value as number)}
                size="small"
              />
              <span>{audio.volume}%</span>
              <Button
                size="small"
                variant="outlined"
                disabled={!employee || !audio.enabled}
                onClick={() => audio.test(employee!.full_name)}
              >
                Nghe thử
              </Button>
            </div>
            {audio.issue && (
              <p className="audio-issue" role="status">
                {audio.issue}
              </p>
            )}
          </div>
        </section>
      </div>
      </div>

      {(uncertain || failure) && (
        <Alert className="result-notice" severity="error" role="alert">
          {uncertain
            ? "Chưa xác định lượt vừa gửi đã được lưu hay chưa. Giữ nguyên thông tin và bấm “Thử lại cùng lượt quét”; hệ thống sẽ không tạo trùng."
            : failure}
          {uncertain && failure && <p>{failure}</p>}
        </Alert>
      )}
      <div className="bottom-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Phản hồi từ máy chủ</span>
              <h2>Kết quả lượt gần nhất</h2>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div className="result-body" aria-live="polite">
            {result ? (
              <>
                <span
                  className={`pill ${result.scan.outcome === "ACCEPTED" ? "green" : "amber"}`}
                >
                  {label(result.scan.outcome)}
                  {result.scan.event_type
                    ? ` · ${label(result.scan.event_type)}`
                    : ""}
                </span>
                <h3>{result.message}</h3>
                <p>
                  {result.scan.decision_snapshot.employee_name ??
                    result.scan.employee_name}{" "}
                  · {result.scan.facility_name}
                </p>
                <span className="subtle">
                  {vietnamTime(result.scan.occurred_at)} ·{" "}
                  {vietnamDate(Date.parse(result.scan.occurred_at))}
                  {result.replayed ? " · Kết quả của lượt đã gửi" : ""}
                </span>
                {result.warnings.map((warning) => (
                  <div className="inline-warning" key={warning}>
                    {label(warning)}
                  </div>
                ))}
              </>
            ) : (
              <div className="empty-state">
                <ScanFace size={30} />
                <strong>Sẵn sàng cho lượt chấm đầu tiên</strong>
                <span>Chọn nhân viên và bấm Quét chấm công.</span>
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">
                {employee?.employee_code ?? "Nhân viên"} ·{" "}
                {vietnamDate(clock.now)}
              </span>
              <h2>Lượt chấm trong ngày</h2>
            </div>
            <Clock3 size={18} />
          </div>
          <QueryBoundary compact>
            {employeeId ? (
              <RecentScans
                employee={employeeId}
                date={vietnamDate(clock.now)}
              />
            ) : (
              <div className="empty-state small">
                Chọn nhân viên để xem lịch sử.
              </div>
            )}
          </QueryBoundary>
        </section>
      </div>
      <p className="footnote">
        Dữ liệu được ghi vào MySQL. Chấm ngoài ca không tự tính OT; thiếu phân
        công support chỉ tạo cảnh báo cho HR.
      </p>
    </>
  );
};
export default ScanDesk;
