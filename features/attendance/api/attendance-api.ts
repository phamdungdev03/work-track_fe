import { apiClient } from "@/lib/api-client";
import type {
  Page,
  Employee,
  Facility,
  Scan,
  ScanPayload,
  ScanResult,
  Schedule,
  Support,
  HrAlert,
  AttendanceRequest,
  Params,
  QrChallenge,
  QrScanPayload,
  SupportCreate,
  SupportFields,
  WorkDay,
  WorkMonth,
} from "../types";

async function list<T>(path: string, params: Params = {}): Promise<Page<T>> {
  const { data } = await apiClient.get<Page<T>>(path, { params });
  if (!Array.isArray(data.results))
    throw new Error("API trả dữ liệu không đúng định dạng danh sách.");
  return data;
}

async function all<T>(path: string, params: Params = {}): Promise<T[]> {
  const result: T[] = [];
  let page = 1;
  while (true) {
    const data = await list<T>(path, { ...params, page, page_size: 100 });
    result.push(...data.results);
    if (!data.next) break;
    page += 1; // Do not follow absolute backend URLs in paginated responses.
    if (page > 1000) throw new Error("Danh sách vượt giới hạn tải của demo.");
  }
  return result;
}

export const attendanceApi = {
  ensureDefaultSchedules: async (work_date: string) =>
    (await apiClient.post<{ work_date: string; created: number; existing: number }>('/schedules/defaults/', { work_date })).data,
  workDays: async (date: string, as_of: string) => (await apiClient.get<WorkDay[]>('/work-days/', { params: { date, as_of } })).data,
  workMonths: async (month: string, as_of: string) => (await apiClient.get<WorkMonth[]>('/work-months/', { params: { month, as_of } })).data,
  createAddEvent: async (payload: { request_id: string; employee_id: number; date: string; facility_id: number; event_type: 'IN' | 'OUT'; occurred_at: string; reason: string; target_scan_id?: number }) => (await apiClient.post<{ request: AttendanceRequest; replayed: boolean }>('/requests/add-event/', payload)).data,
  employees: () => all<Employee>("/employees/"),
  facilities: () => all<Facility>("/facilities/"),
  scans: (params: Params) => list<Scan>("/scans/", params),
  dailyScans: (date: string) => all<Scan>("/scans/", { date }),
  dailySchedules: (date: string) => all<Schedule>("/schedules/", { date }),
  dailyAlerts: (date: string) => all<HrAlert>("/alerts/", { date }),
  dailyRequests: (date: string) => all<AttendanceRequest>("/requests/", { date }),
  employeeDayScans: (employeeId: number, date: string) =>
    all<Scan>("/scans/", { employee_id: employeeId, date }),
  alertScans: (id: number) => all<Scan>("/scans/", { alert_id: id }),
  allSchedules: () => all<Schedule>("/schedules/"),
  schedules: (params: Params) => list<Schedule>("/schedules/", params),
  createDemoSchedule: async (employee_id: number, work_date: string) =>
    (
      await apiClient.post<{ schedule: Schedule; replayed: boolean }>(
        "/schedules/demo-create/",
        { employee_id, work_date },
      )
    ).data,
  support: (params: Params) => list<Support>("/support-assignments/", params),
  createSupport: async (payload: SupportCreate) =>
    (
      await apiClient.post<{ assignment: Support; replayed: boolean }>(
        "/support-assignments/create/",
        payload,
      )
    ).data,
  updateSupport: async (
    id: number,
    payload: SupportFields & { expected_updated_at: string },
  ) =>
    (
      await apiClient.put<{ assignment: Support }>(
        `/support-assignments/${id}/`,
        payload,
      )
    ).data,
  cancelSupport: async (
    id: number,
    expected_updated_at: string,
    reason: string,
  ) =>
    (
      await apiClient.post<{ assignment: Support }>(
        `/support-assignments/${id}/cancel/`,
        { expected_updated_at, reason },
      )
    ).data,
  alerts: (params: Params) => list<HrAlert>("/alerts/", params),
  requests: (params: Params) => list<AttendanceRequest>("/requests/", params),
  verifyAlert: async (
    id: number,
    review_note: string,
    expected_last_seen_at: string,
  ) =>
    (
      await apiClient.post<{ alert: HrAlert; replayed: boolean }>(
        `/alerts/${id}/verify/`,
        { review_note, expected_last_seen_at },
      )
    ).data,
  reviewRequest: async (
    id: number,
    decision: "APPROVED" | "REJECTED",
    review_note: string,
    expected_version: number,
  ) =>
    (
      await apiClient.post<{ request: AttendanceRequest; replayed: boolean }>(
        `/requests/${id}/review/`,
        { decision, review_note, expected_version },
      )
    ).data,
  issueQr: async (
    facilityId: number,
    previousToken?: string,
    revokeExisting = false,
    rotationId?: string,
  ): Promise<QrChallenge> =>
    (
      await apiClient.post<QrChallenge>("/qr/challenges/", {
        facility_id: facilityId,
        ...(previousToken ? { previous_token: previousToken } : {}),
        ...(revokeExisting ? { revoke_existing: true } : {}),
        ...(rotationId ? { rotation_id: rotationId } : {}),
      })
    ).data,
  scanQr: async (payload: QrScanPayload): Promise<ScanResult> =>
    (await apiClient.post<ScanResult>("/qr/scans/", payload)).data,
  scan: async (payload: ScanPayload): Promise<ScanResult> =>
    (await apiClient.post<ScanResult>("/scans/demo/", payload)).data,
};
