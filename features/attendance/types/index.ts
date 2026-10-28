export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface Employee {
  id: number;
  employee_code: string;
  full_name: string;
  home_facility_id: number;
  home_facility_name: string;
  hired_on: string;
  ended_on: string | null;
  status: string;
}
export interface Facility {
  id: number;
  code: string;
  name: string;
  address: string;
  is_active: boolean;
  min_scan_interval_seconds: number;
  qr_ttl_seconds: number;
}
export type Outcome = "ACCEPTED" | "IGNORED" | "REJECTED" | "PENDING_REVIEW";
export interface Scan {
  id: number;
  employee_id: number | null;
  employee_name: string | null;
  facility_id: number;
  facility_name: string;
  source_type: string;
  occurred_at: string;
  received_at: string;
  outcome: Outcome;
  event_type: "IN" | "OUT" | null;
  reason_code: string;
  decision_snapshot: {
    message?: string;
    employee_name?: string;
    warnings?: string[];
  };
  alert_id: number | null;
}
export interface ScanPayload {
  request_id: string;
  employee_id: number;
  facility_id: number;
  occurred_at?: string;
  recognition: "MATCH" | "NO_FACE" | "UNREGISTERED";
}
export interface ScanResult {
  scan: Scan;
  message: string;
  replayed: boolean;
  warnings: string[];
}
export interface Schedule {
  id: number;
  employee: number;
  owner_facility: number;
  work_date: string;
  starts_at: string;
  ends_at: string;
  unpaid_break_minutes: number;
  standard_work_minutes: number;
  status: string;
  locked_at: string | null;
}
export interface Support {
  id: number;
  updated_at: string;
  schedule: number;
  from_facility: number;
  to_facility: number;
  depart_at: string;
  expected_arrival_at: string;
  support_ends_at: string;
  status: string;
  reason: string;
}
export interface HrAlert {
  id: number;
  employee: number;
  facility: number;
  work_date: string;
  alert_type: string;
  status: string;
  review_note: string | null;
  last_seen_at: string;
}
export interface AttendanceRequest {
  id: number;
  employee: number;
  schedule: number | null;
  request_type: string;
  version: number;
  target_scan: number | null;
  origin_scan: number | null;
  status: string;
  reason: string;
  proposed_event_type: string | null;
  proposed_facility: number | null;
  proposed_occurred_at: string | null;
  review_note: string | null;
  created_at: string;
}
export type View =
  | "scan"
  | "daily"
  | "history"
  | "employees"
  | "schedules"
  | "alerts"
  | "requests";
export type Params = Record<string, string | number | undefined>;

export interface QrChallenge {
  token: string;
  facility_id: number;
  issued_at: string;
  expires_at: string;
  server_now: string;
}
export interface QrScanPayload {
  request_id: string;
  employee_id: number;
  facility_id: number;
  occurred_at?: string;
  qr_token: string;
  gps_status: "IN_RANGE" | "OUT_OF_RANGE" | "UNAVAILABLE";
}
export type PendingScan =
  | { mode: "face"; payload: ScanPayload }
  | { mode: "qr"; payload: QrScanPayload };

export interface SupportFields {
  from_facility_id: number;
  to_facility_id: number;
  depart_at: string;
  expected_arrival_at: string;
  support_ends_at: string;
  reason: string;
}
export interface SupportCreate extends SupportFields {
  request_id: string;
  schedule_id: number;
}
export type SupportFormAction =
  | {
      mode: "create";
      employeeId?: number;
      date: string;
      targetFacility?: number;
      fromAlert?: boolean;
    }
  | {
      mode: "edit" | "cancel";
      assignment: Support;
      employeeId: number;
      date: string;
    };
