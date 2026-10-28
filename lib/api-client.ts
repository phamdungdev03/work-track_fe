import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response)
      return "Không kết nối được máy chủ. Kiểm tra Django đang chạy ở cổng 8000.";
    const data: unknown = error.response.data;
    if (data && typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
      const detail = entries.find(([key]) => key === "detail")?.[1];
      if (typeof detail === "string") return detail;
      const messages = entries.map(
        ([key, value]) =>
          `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`,
      );
      if (messages.length) return messages.join(" · ");
    }
    return `Máy chủ chưa phản hồi hợp lệ (HTTP ${error.response.status}).`;
  }
  return error instanceof Error
    ? error.message
    : "Không tải được dữ liệu. Vui lòng thử lại.";
}

export function isAmbiguousFailure(error: unknown): boolean {
  return (
    !axios.isAxiosError(error) ||
    !error.response ||
    error.response.status >= 500 ||
    error.response.status === 408
  );
}
