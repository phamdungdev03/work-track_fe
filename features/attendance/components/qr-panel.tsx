"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { FormField } from "@/components/ui/form-field";
import { useCallback, useEffect, useRef, useState, type FC } from "react";
import { Alert } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ScanLine } from "lucide-react";
import { attendanceApi } from "../api/attendance-api";
import type { QrChallenge, QrScanPayload } from "../types";
import { errorMessage } from "@/lib/api-client";
import { isAxiosError } from "axios";

const pendingRotations = new Map<number, string>();
function rotationKey(facilityId: number) { return `worktrack:qr-rotation:${facilityId}`; }
function getRotation(facilityId: number): string | undefined {
  try { return sessionStorage.getItem(rotationKey(facilityId)) ?? pendingRotations.get(facilityId); }
  catch { return pendingRotations.get(facilityId); }
}
function saveRotation(facilityId: number, id: string) {
  pendingRotations.set(facilityId, id);
  try { sessionStorage.setItem(rotationKey(facilityId), id); } catch { /* Memory fallback. */ }
}
function clearRotation(facilityId: number, id: string) {
  if (getRotation(facilityId) !== id) return;
  pendingRotations.delete(facilityId);
  try { sessionStorage.removeItem(rotationKey(facilityId)); } catch { /* Memory fallback. */ }
}

interface Props {
  active: boolean;
  facilityId: number | null;
  facilityName: string;
  captured: string;
  setCaptured: (value: string) => void;
  gps: QrScanPayload["gps_status"];
  setGps: (value: QrScanPayload["gps_status"]) => void;
  disabled: boolean;
}
const QrPanel: FC<Props> = ({
  active,
  facilityId,
  facilityName,
  captured,
  setCaptured,
  gps,
  setGps,
  disabled,
}) => {
  const [cycle, setCycle] = useState(0);
  const [challenge, setChallenge] = useState<QrChallenge | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const expiresAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const issuing = useRef(false);
  const retryRotation = useRef<string | null>(null);

  const issue = useCallback(
    async (rotationId?: string) => {
      if (!facilityId || issuing.current) return;
      issuing.current = true;
      setBusy(true);
      setError("");
      if (rotationId) {
        saveRotation(facilityId, rotationId);
        retryRotation.current = rotationId;
        setChallenge(null);
        setRemaining(0);
        expiresAt.current = 0;
        if (timer.current) clearTimeout(timer.current);
      }
      const version = generation.current;
      const started = performance.now();
      try {
        const data = await attendanceApi.issueQr(facilityId, undefined, !!rotationId, rotationId);
        if (generation.current !== version) return;
        const duration = Math.max(
          0,
          Date.parse(data.expires_at) -
            Date.parse(data.server_now) -
            (performance.now() - started),
        );
        expiresAt.current = performance.now() + duration;
        setRemaining(Math.ceil(duration / 1000));
        setChallenge(data);
        if (rotationId) clearRotation(facilityId, rotationId);
        retryRotation.current = null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(
          () => setCycle((value) => value + 1),
          duration,
        );
      } catch (err) {
        if (generation.current === version) {
          if (rotationId && isAxiosError(err) && err.response?.status === 409) {
            clearRotation(facilityId, rotationId);
            retryRotation.current = null;
            setError("Mã của lần đổi trước đã hết hạn hoặc bị thu hồi. Vui lòng lấy mã mới.");
          } else {
            setError(rotationId ? "Chưa xác định được mã mới. Vui lòng thử lại." : errorMessage(err));
          }
        }
      } finally {
        if (generation.current === version) {
          issuing.current = false;
          setBusy(false);
        }
      }
    },
    [facilityId],
  );

  useEffect(() => {
    if (!active) return;
    generation.current += 1;
    issuing.current = false;
    const start = setTimeout(() => void issue(facilityId ? getRotation(facilityId) : undefined), 0);
    const tick = setInterval(
      () =>
        setRemaining(
          Math.max(
            0,
            Math.ceil((expiresAt.current - performance.now()) / 1000),
          ),
        ),
      250,
    );
    return () => {
      generation.current += 1;
      issuing.current = false;
      retryRotation.current = null;
      clearTimeout(start);
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [issue, cycle, active, facilityId]);

  const current = challenge?.facility_id === facilityId ? challenge : null;
  return (
    <div className="qr-demo-panel">
      <div className="qr-heading">
        <div>
          <strong>QR động tại cơ sở</strong>
          <small>{facilityName} · Đổi theo giờ thực</small>
          <small className="qr-support-note">Dùng khi cơ sở support chưa có máy quét mặt.</small>
        </div>
        <span className={`pill ${remaining > 5 ? "green" : "amber"}`}>
          {current ? `Còn ${remaining}s` : "Đang tải"}
        </span>
      </div>
      <div className="qr-content">
        <div className="qr-image">
          {current && remaining > 0 ? (
            <QRCodeSVG
              value={current.token}
              size={164}
              level="M"
              marginSize={2}
              title={`QR chấm công ${facilityName}`}
            />
          ) : (
            <span>{error ? "Chưa có mã hợp lệ" : "Đang lấy mã…"}</span>
          )}
        </div>
        <div className="qr-instructions">
          <strong>Quét mã tại điểm support</strong>
          <p>
            Nhấn lấy mã để mô phỏng điện thoại đọc QR. Mã đã đọc được giữ lại để
            thử hết hạn hoặc sai cơ sở.
          </p>
          <Button
            size="small"
            variant="contained"
            disabled={!current || remaining <= 0 || busy || disabled}
            startIcon={<ScanLine size={15} />}
            onClick={() => setCaptured(current!.token)}
          >
            Lấy mã đang hiển thị
          </Button>
          <Button
            size="small"
            disabled={!current || busy || disabled}
            startIcon={<RefreshCw size={14} />}
            onClick={() => {
              void issue(crypto.randomUUID());
            }}
          >
            Đổi mã ngay
          </Button>
        </div>
      </div>
      {error && (
        <Alert
          severity="error"
          action={<Button disabled={busy || disabled} onClick={() => void issue(retryRotation.current ?? undefined)}>Thử lại</Button>}
        >
          {error}
        </Alert>
      )}
      <div className="qr-inputs">
        <FormField
          label="Mã QR đã đọc"
          placeholder="Chưa lấy mã"
          value={captured}
          disabled={disabled}
          onChange={(event) => setCaptured(event.target.value)}
          helperText="Có thể xóa hoặc sửa mã để thử trường hợp thiếu / sai QR."
          fullWidth
        />
        <FormField
          select
          label="Vị trí mô phỏng"
          value={gps}
          disabled={disabled}
          onChange={(event) =>
            setGps(event.target.value as QrScanPayload["gps_status"])
          }
          fullWidth
        >
          <option value="IN_RANGE">Trong khu vực cơ sở</option>
          <option value="OUT_OF_RANGE">Ngoài khu vực cơ sở</option>
          <option value="UNAVAILABLE">Không lấy được vị trí</option>
        </FormField>
      </div>
      <p className="qr-hint">
        QR do backend phát và kiểm tra. Vị trí/đọc QR chỉ mô phỏng; chưa dùng
        GPS hoặc camera thật.
      </p>
    </div>
  );
};
export default QrPanel;
