"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { FormField } from "@/components/ui/form-field";
import { EmployeeSelect } from "./employee-select";
import { useRef, useState, type FC } from "react";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../api/attendance-api";
import { vietnamTime } from "../helpers/format";
import type {
  Employee,
  Facility,
  SupportCreate,
  SupportFields,
  SupportFormAction,
} from "../types";
import { errorMessage, isAmbiguousFailure } from "@/lib/api-client";
import { useMuiSnackbar } from "@/hooks/use-mui-snackbar";

interface Props {
  action: SupportFormAction;
  employees: Employee[];
  facilities: Facility[];
  onClose: () => void;
}
const localTime = (input: string) => vietnamTime(input).slice(0, 5);
const stamp = (date: string, time: string) =>
  `${date}T${time.length === 5 ? `${time}:00` : time}+07:00`;

const SupportForm: FC<Props> = ({ action, employees, facilities, onClose }) => {
  const isCreate = action.mode === "create";
  const assignment = action.mode === "create" ? null : action.assignment;
  const [employeeId, setEmployeeId] = useState<number | null>(
    action.employeeId ?? null,
  );
  const [date, setDate] = useState(action.date);
  const [from, setFrom] = useState<number | "">(
    assignment?.from_facility ??
      employees.find((e) => e.id === action.employeeId)?.home_facility_id ??
      "",
  );
  const [fromTouched, setFromTouched] = useState(false);
  const [to, setTo] = useState<number | "">(
    assignment?.to_facility ??
      (isCreate ? action.targetFacility : undefined) ??
      "",
  );
  const [depart, setDepart] = useState(
    assignment ? localTime(assignment.depart_at) : "10:00",
  );
  const [end, setEnd] = useState(
    assignment ? localTime(assignment.support_ends_at) : "17:30",
  );
  const [reason, setReason] = useState(
    action.mode === "cancel" ? "" : (assignment?.reason ?? ""),
  );
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const pendingCreate = useRef<SupportCreate | null>(null);
  const queryClient = useQueryClient();
  const notify = useMuiSnackbar();
  const person = employees.find((e) => e.id === employeeId) ?? null;
  const scheduleQuery = useQuery({
    queryKey: ["schedules", "for-support", employeeId, date],
    queryFn: () =>
      attendanceApi.schedules({
        employee_id: employeeId!,
        date,
        page_size: 100,
      }),
    enabled: action.mode !== "cancel" && !!employeeId && !!date,
    staleTime: 10000,
  });
  const schedule = scheduleQuery.data?.results.find(
    (item) =>
      item.employee === employeeId &&
      item.work_date === date &&
      item.status === "SCHEDULED",
  );
  const actualFrom =
    isCreate && !fromTouched && schedule ? schedule.owner_facility : from;
  const createSchedule = useMutation({
    mutationFn: () => attendanceApi.createDemoSchedule(employeeId!, date),
    onSuccess: (result) => {
      setError("");
      notify(
        result.replayed
          ? "Ca đã tồn tại, đã tải lại."
          : "Đã tạo ca demo 08:30 – 17:30.",
        "success",
      );
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });
  const mutation = useMutation({
    mutationFn: async (
      payload:
        | SupportCreate
        | (SupportFields & { expected_updated_at: string })
        | { expected_updated_at: string; reason: string },
    ) => {
      if (action.mode === "create")
        return attendanceApi.createSupport(payload as SupportCreate);
      if (action.mode === "cancel")
        return attendanceApi.cancelSupport(
          action.assignment.id,
          (payload as { expected_updated_at: string }).expected_updated_at,
          payload.reason,
        );
      return attendanceApi.updateSupport(
        action.assignment.id,
        payload as SupportFields & { expected_updated_at: string },
      );
    },
    onSuccess: () => {
      const message =
        action.mode === "create" && action.fromAlert
          ? "Đã tạo phân công. Cảnh báo vẫn cần HR xác minh riêng."
          : action.mode === "create"
            ? "Đã tạo phân công support."
            : action.mode === "edit"
              ? "Đã cập nhật phân công."
              : "Đã hủy phân công.";
      notify(message, "success");
      void queryClient.invalidateQueries({ queryKey: ["support"] });
      void queryClient.invalidateQueries({ queryKey: ["schedules"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      onClose();
    },
    onError: (err) => {
      const ambiguous = isAmbiguousFailure(err);
      setError(
        ambiguous && isCreate
          ? "Chưa rõ yêu cầu đã được lưu hay chưa. Bấm thử lại để gửi đúng yêu cầu trước."
          : errorMessage(err),
      );
      setUncertain(ambiguous && isCreate);
      if (!ambiguous) pendingCreate.current = null;
      void queryClient.invalidateQueries({ queryKey: ["support"] });
    },
  });
  const submit = () => {
    setError("");
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do.");
      return;
    }
    if (action.mode === "cancel") {
      mutation.mutate({
        expected_updated_at: action.assignment.updated_at,
        reason: reason.trim(),
      });
      return;
    }
    if (
      !employeeId ||
      !date ||
      !schedule ||
      !actualFrom ||
      !to ||
      !depart ||
      !end
    ) {
      setError("Vui lòng chọn nhân viên, ca và điền đủ thông tin.");
      return;
    }
    if (actualFrom === to) {
      setError("Cơ sở đến phải khác cơ sở đi.");
      return;
    }
    const fields = {
      from_facility_id: actualFrom,
      to_facility_id: to,
      depart_at: stamp(date, depart),
      support_ends_at: stamp(date, end),
      reason: reason.trim(),
    };
    if (depart >= end) {
      setError(
        "Giờ bắt đầu support phải trước giờ kết thúc.",
      );
      return;
    }
    if (action.mode === "create") {
      const payload = pendingCreate.current ?? {
        ...fields,
        request_id: requestId.current,
        schedule_id: schedule.id,
      };
      pendingCreate.current = payload;
      mutation.mutate(payload);
    } else
      mutation.mutate({
        ...fields,
        expected_updated_at: action.assignment.updated_at,
      });
  };
  const locked = mutation.isPending || uncertain;
  const title =
    action.mode === "create"
      ? "Tạo phân công support"
      : action.mode === "edit"
        ? "Chỉnh sửa phân công"
        : "Hủy phân công support";
  return (
    <Dialog
      open
      onClose={() => {
        if (!mutation.isPending && !createSchedule.isPending) onClose();
      }}
      aria-labelledby="support-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="support-title">{title}</DialogTitle>
      <DialogContent dividers>
        <div className="support-form">
          {action.mode === "cancel" ? (
            <>
              <p>
                Hủy phân công của{" "}
                <strong>{person?.full_name ?? "nhân viên"}</strong> ngày{" "}
                {date.split("-").reverse().join("/")}?
              </p>
              <p>
                Phân công được giữ trong lịch sử với trạng thái đã hủy; lượt
                chấm và cảnh báo HR không tự thay đổi.
              </p>
            </>
          ) : (
            <>
              <EmployeeSelect
                employees={employees}
                value={person}
                disabled={locked || createSchedule.isPending || !isCreate}
                required
                onChange={(value) => {
                  setEmployeeId(value?.id ?? null);
                  setFrom(value?.home_facility_id ?? "");
                  setFromTouched(false);
                }}
              />
              <FormField
                label="Ngày làm việc"
                type="date"
                value={date}
                disabled={locked || createSchedule.isPending || !isCreate}
                onChange={(e) => setDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
              {employeeId &&
                date &&
                (scheduleQuery.isLoading ? (
                  <Alert severity="info">Đang kiểm tra lịch ca…</Alert>
                ) : scheduleQuery.isError ? (
                  <Alert
                    severity="error"
                    action={
                      <Button onClick={() => void scheduleQuery.refetch()}>
                        Thử lại
                      </Button>
                    }
                  >
                    {errorMessage(scheduleQuery.error)}
                  </Alert>
                ) : !schedule ? (
                  <Alert
                    severity="warning"
                    action={
                      <Button
                        disabled={
                          createSchedule.isPending ||
                          locked ||
                          action.mode !== "create"
                        }
                        onClick={() => createSchedule.mutate()}
                      >
                        {createSchedule.isPending ? "Đang tạo…" : "Tạo ca demo"}
                      </Button>
                    }
                  >
                    Nhân viên chưa có ca. Bạn có thể tạo ca demo 08:30–17:30
                    (nghỉ 60 phút) trước khi phân công.
                  </Alert>
                ) : (
                  <Alert severity={schedule.locked_at ? "warning" : "success"}>
                    {schedule.locked_at
                      ? "Ngày công đã khóa, không thể thay đổi phân công."
                      : `Ca ${localTime(schedule.starts_at)} – ${localTime(schedule.ends_at)} · Chọn thời gian nằm trong ca.`}
                  </Alert>
                ))}
              <div className="two-fields">
                <FormField
                  select
                  label="Cơ sở đi"
                  value={actualFrom}
                  disabled={locked}
                  onChange={(e) => {
                    setFrom(Number(e.target.value));
                    setFromTouched(true);
                  }}
                  required
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id} disabled={!f.is_active}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </FormField>
                <FormField
                  select
                  label="Cơ sở đến"
                  value={to}
                  disabled={locked}
                  onChange={(e) => setTo(Number(e.target.value))}
                  required
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id} disabled={!f.is_active}>
                      {f.code} · {f.name}
                    </option>
                  ))}
                </FormField>
              </div>
              <div className="support-times">
                <FormField
                  label="Bắt đầu support"
                  type="time"
                  value={depart}
                  disabled={locked}
                  onChange={(e) => setDepart(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
                <FormField
                  label="Kết thúc support"
                  type="time"
                  value={end}
                  disabled={locked}
                  onChange={(e) => setEnd(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  required
                />
              </div>
              {isCreate && action.fromAlert && (
                <p className="subtle">
                  Tạo phân công bổ sung không tự xác minh cảnh báo; HR kiểm tra
                  và xác minh riêng.
                </p>
              )}
            </>
          )}
          <FormField
            label={action.mode === "cancel" ? "Lý do hủy" : "Lý do support"}
            value={reason}
            disabled={locked}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            required
          />
          {error && <Alert severity="error">{error}</Alert>}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          disabled={mutation.isPending || createSchedule.isPending}
        >
          Đóng
        </Button>
        <Button
          variant="contained"
          color={action.mode === "cancel" ? "error" : "primary"}
          onClick={submit}
          disabled={
            mutation.isPending ||
            (!uncertain &&
              (!reason.trim() ||
                (action.mode !== "cancel" &&
                  (!schedule || !!schedule.locked_at))))
          }
        >
          {mutation.isPending
            ? "Đang lưu…"
            : uncertain
              ? "Thử lại cùng yêu cầu"
              : action.mode === "cancel"
                ? "Xác nhận hủy"
                : "Lưu phân công"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default SupportForm;
