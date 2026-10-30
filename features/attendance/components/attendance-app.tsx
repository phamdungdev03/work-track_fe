"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { lazy, Suspense, useState, type FC } from "react";
import Image from "next/image";
import { useSuspenseQueries } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  FileClock,
  ScanFace,
  ShieldCheck,
  Users,
  Menu,
  X,
} from "lucide-react";
import {
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import Providers from "@/components/providers";
import { QueryBoundary } from "@/components/query-boundary";
import { attendanceApi } from "../api/attendance-api";
import { useDemoClock } from "../hooks/use-demo-clock";
import { useDefaultSchedules } from "../hooks/use-default-schedules";
import { vietnamDate, shortDate } from "../helpers/format";
import type { View } from "../types";
import ScanDesk from "./scan-desk";
const RecordsView = lazy(() => import("./records-view"));
const DailyAttendance = lazy(() => import("./daily-attendance"));

const navigation = [
  { id: "scan" as const, name: "Quét chấm công", icon: ScanFace },
  { id: "daily" as const, name: "Chấm công hằng ngày", icon: CalendarDays },
  { id: "history" as const, name: "Lịch sử chấm công", icon: Clock3 },
  { id: "employees" as const, name: "Nhân viên", icon: Users },
  { id: "schedules" as const, name: "Lịch & phân công", icon: CalendarDays },
  { id: "alerts" as const, name: "Cảnh báo HR", icon: ShieldCheck },
  { id: "requests" as const, name: "Giải trình", icon: FileClock },
];
const titles: Record<View, { title: string; description: string }> = {
  scan: {
    title: "Chấm công, thật đơn giản.",
    description: "Một lần quét. Ghi nhận đúng người, đúng nơi, đúng thời điểm.",
  },
  daily: {
    title: "Chấm công hằng ngày",
    description:
      "Theo dõi lượt vào, ra và các trường hợp cần xác minh theo từng nhân viên.",
  },
  history: {
    title: "Lịch sử chấm công",
    description:
      "Theo dõi toàn bộ lượt vào, ra và những lần không được ghi nhận.",
  },
  employees: {
    title: "Nhân viên",
    description: "Danh sách nhân viên và cơ sở làm việc từ hệ thống.",
  },
  schedules: {
    title: "Lịch làm việc & support",
    description: "Đối chiếu ca làm và các phân công giữa cơ sở.",
  },
  alerts: {
    title: "Cảnh báo cần xác minh",
    description: "Thiếu phân công vẫn chấm bình thường. HR hậu kiểm tại đây.",
  },
  requests: {
    title: "Giải trình chấm công",
    description: "Theo dõi các yêu cầu bổ sung lượt và xác minh hiện diện.",
  },
};

const Workspace: FC<{ view: View; clock: ReturnType<typeof useDemoClock> }> = ({
  view,
  clock,
}) => {
  const [employeesQuery, facilitiesQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["employees"],
        queryFn: attendanceApi.employees,
        staleTime: 60000,
      },
      {
        queryKey: ["facilities"],
        queryFn: attendanceApi.facilities,
        staleTime: 60000,
      },
    ],
  });
  const employees = employeesQuery.data;
  const facilities = facilitiesQuery.data;
  const stale = !!employeesQuery.error || !!facilitiesQuery.error;
  const scheduleSetup = useDefaultSchedules(vietnamDate(clock.now));
  return (
    <>
      {scheduleSetup.error && (
        <Alert
          severity="warning"
          action={<Button onClick={scheduleSetup.retry}>Thử lại</Button>}
        >
          Không thể tạo ca mặc định. Hãy kiểm tra kết nối và thử lại.
        </Alert>
      )}
      <div className="summary-strip">
        <div>
          <span className="summary-icon">
            <Users size={19} />
          </span>
          <span>
            <strong>{employees.length}</strong>
            <small>Nhân viên</small>
          </span>
        </div>
        <div>
          <span className="summary-icon">
            <Building2 size={19} />
          </span>
          <span>
            <strong>{facilities.length}</strong>
            <small>Cơ sở làm việc</small>
          </span>
        </div>
        <div>
          <span className="summary-icon">
            <Clock3 size={19} />
          </span>
          <span>
            <strong>08:30 – 17:30</strong>
            <small>Ca mẫu · nghỉ 60 phút</small>
          </span>
        </div>
        <div className="connection">
          <span className={`live-dot ${stale ? "offline" : ""}`} />
          <span>
            {stale ? "Chưa cập nhật được dữ liệu" : "Dữ liệu sẵn sàng"}
            <small>
              {stale
                ? "Đang hiển thị dữ liệu đã tải"
                : "Nhân viên và cơ sở đã tải"}
            </small>
          </span>
        </div>
      </div>
      <div hidden={view !== "scan"}>
        <ScanDesk
          employees={employees}
          facilities={facilities}
          clock={clock}
          active={view === "scan"}
        />
      </div>
      {view === "daily" && (
        <Suspense fallback={<Skeleton variant="rounded" height={450} />}>
          <DailyAttendance
            employees={employees}
            facilities={facilities}
            initialDate={vietnamDate(clock.now)}
            now={clock.now}
          />
        </Suspense>
      )}
      {view !== "scan" && view !== "daily" && (
        <Suspense fallback={<Skeleton variant="rounded" height={450} />}>
          <RecordsView
            key={view}
            view={view}
            employees={employees}
            facilities={facilities}
            initialDate={vietnamDate(clock.now)}
          />
        </Suspense>
      )}
    </>
  );
};
const AppShell: FC = () => {
  const [view, setView] = useState<View>("scan");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const clock = useDemoClock();
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <Image
            className="company-logo"
            src="/logo_1682346838.png.webp"
            alt="Logo Hương Việt Sinh"
            width={52}
            height={47}
            priority
          />
          <span className="company-name">
            <strong>Hương Việt Sinh</strong>
            <small>Hệ thống chấm công</small>
          </span>
          <button
            className="mobile-close icon-button"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-tag">
          <span className="workspace-avatar">HV</span>
          <div>
            <strong>Chấm công</strong>
            <small>Quản lý nhiều cơ sở</small>
          </div>
          <Building2 size={16} />
        </div>
        <p className="nav-label">Không gian làm việc</p>
        <nav aria-label="Điều hướng chính">
          {navigation.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => {
                setView(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              {name}
              {view === id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">

          <div className="demo-workspace">
            <span className="live-dot" />
            <div>
              <strong>Mai Anh</strong>
              <small>HR · Vai trò xem thử</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Mở menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </button>
            <span>Không gian làm việc</span>
            <i>/</i>
            <strong>{navigation.find((item) => item.id === view)?.name}</strong>
          </div>
          <div className="top-actions">
            <span className="header-date">
              <CalendarDays size={14} />
              {shortDate(vietnamDate(clock.now))}
            </span>
            <span className="pill green">DEMO</span>
            <button
              className="icon-button"
              aria-label="Hướng dẫn demo"
              onClick={() => setHelp(!help)}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">Hương Việt Sinh / Chấm công</span>
              <h1>{titles[view].title}</h1>
              <p>{titles[view].description}</p>
            </div>
            <span className="page-emblem">
              <ScanFace size={25} />
            </span>
          </div>
          <Dialog
            open={help}
            onClose={() => setHelp(false)}
            aria-labelledby="help-title"
            fullWidth
            maxWidth="sm"
          >
            <DialogTitle id="help-title">Cách thử nhanh</DialogTitle>
            <DialogContent dividers>
              <div className="help-dialog-content">
                <p>
                  Chọn nhân viên và cơ sở, sau đó quét mặt hoặc chọn QR đi
                  support để ghi nhận.
                </p>
                <p>
                  Quét lại trước 10 giây để thử chống lặp; chỉnh giờ demo để thử
                  lượt ra. Đổi cơ sở để xem cảnh báo support.
                </p>
                <p>
                  Với QR, bấm lấy mã đang hiển thị, chọn vị trí mô phỏng rồi
                  chấm công. HR có thể xác minh cảnh báo và duyệt yêu cầu hiện
                  diện.
                </p>
                <p>
                  Giờ ngoài ca không tự tính OT. Nhận diện và vị trí là mô
                  phỏng; công ngày được tính từ các lượt hợp lệ.
                </p>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setHelp(false)} variant="contained">
                Đã hiểu
              </Button>
            </DialogActions>
          </Dialog>
          <QueryBoundary>
            <Workspace view={view} clock={clock} />
          </QueryBoundary>
        </main>
        <footer className="app-footer">
          <span>Hương Việt Sinh · Hệ thống chấm công.</span>
          <span>Chấm công nhiều cơ sở</span>
        </footer>
      </div>
    </div>
  );
};
const AttendanceApp: FC = () => (
  <Providers>
    <AppShell />
  </Providers>
);
export default AttendanceApp;
