"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton as Button } from "@/components/ui/app-button";
import { FormField } from "@/components/ui/form-field";
import { errorMessage } from "@/lib/api-client";
import { attendanceApi } from "../api/attendance-api";
import type { Employee, Facility } from "../types";
import { vietnamTime } from "../helpers/format";

export function AddEventDialog({
  employee,
  date,
  facilities,
  onClose,
}: {
  employee: Employee;
  date: string;
  facilities: Facility[];
  onClose: () => void;
}) {
  const [eventType, setEventType] = useState<"IN" | "OUT">("OUT");
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [targetScan, setTargetScan] = useState("");
  const [facility, setFacility] = useState(String(employee.home_facility_id));
  const [time, setTime] = useState("17:30");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const attempt = useRef<{ id: string; payload: string } | null>(null);
  const client = useQueryClient();
  const scans = useQuery({
    queryKey: ["scans", "request-form", employee.id, date],
    queryFn: () => attendanceApi.employeeDayScans(employee.id, date),
    enabled: mode === "replace",
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (
        !reason.trim() ||
        !time ||
        !facility ||
        (mode === "replace" && !targetScan)
      )
        throw new Error("Vui lòng nhập đầy đủ thông tin.");
      const payload = {
        employee_id: employee.id,
        date,
        facility_id: Number(facility),
        event_type: eventType,
        occurred_at: `${date}T${time}:00+07:00`,
        reason: reason.trim(),
        ...(mode === "replace" ? { target_scan_id: Number(targetScan) } : {}),
      };
      const serialized = JSON.stringify(payload);
      if (!attempt.current || attempt.current.payload !== serialized)
        attempt.current = { id: crypto.randomUUID(), payload: serialized };
      return attendanceApi.createAddEvent({
        ...payload,
        request_id: attempt.current.id,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["requests"] });
      void client.invalidateQueries({ queryKey: ["daily-attendance"] });
      onClose();
    },
    onError: (error) => setMessage(errorMessage(error)),
  });
  return (
    <Dialog
      open
      onClose={mutation.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Giải trình lượt chấm · {employee.full_name}</DialogTitle>
      <DialogContent>
        <p className="read-note mb-2">
          Ngày {date}. HR sẽ xem xét yêu cầu; các lượt chấm gốc được giữ nguyên.
        </p>
        {message && <Alert severity="error">{message}</Alert>}
        <div className="grid gap-4">
          <FormField
            select
            label="Loại giải trình"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as "add" | "replace");
              setTargetScan("");
            }}
          >
            <option value="add">Bổ sung lượt thiếu</option>
            <option value="replace">Sửa lượt chấm sai</option>
          </FormField>
          {mode === "replace" && (
            <>
              <p className="read-note">
                Nếu quên IN đầu ngày và lượt ra bị máy suy thành IN, gửi yêu cầu
                sửa lượt đó thành OUT trước, rồi gửi yêu cầu bổ sung IN.
              </p>
              <FormField
                select
                label="Lượt chấm cần sửa"
                value={targetScan}
                onChange={(e) => setTargetScan(e.target.value)}
              >
                <option value="">Chọn lượt chấm</option>
                {scans.data
                  ?.filter((scan) => scan.outcome === "ACCEPTED")
                  .map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {vietnamTime(scan.occurred_at)} ·{" "}
                      {scan.event_type === "IN" ? "Vào" : "Ra"} ·{" "}
                      {scan.facility_name}
                    </option>
                  ))}
              </FormField>
              {scans.isError && (
                <Alert severity="error">
                  Không tải được lượt chấm: {errorMessage(scans.error)}
                </Alert>
              )}
            </>
          )}
          <FormField
            select
            label="Lượt cần bổ sung"
            value={eventType}
            onChange={(e) => setEventType(e.target.value as "IN" | "OUT")}
          >
            <option value="IN">Vào</option>
            <option value="OUT">Ra</option>
          </FormField>
          <FormField
            select
            label="Cơ sở"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
          >
            <option value="">Chọn cơ sở</option>
            {facilities
              .filter((f) => f.is_active)
              .map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
          </FormField>
          <FormField
            label="Giờ đề xuất"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          <FormField
            label="Lý do"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            required
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Gửi giải trình
        </Button>
      </DialogActions>
    </Dialog>
  );
}
