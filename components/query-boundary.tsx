"use client";
import { AppButton as Button } from "@/components/ui/app-button";
import { Suspense, type FC, type PropsWithChildren } from "react";
import { Alert, Skeleton } from "@mui/material";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { errorMessage } from "@/lib/api-client";

export const QueryBoundary: FC<PropsWithChildren<{ compact?: boolean }>> = ({
  children,
  compact = false,
}) => (
  <QueryErrorResetBoundary>
    {({ reset }) => (
      <ErrorBoundary
        onReset={reset}
        fallbackRender={({ error, resetErrorBoundary }) => (
          <div className="data-fallback">
            <Alert severity="error">{errorMessage(error)}</Alert>
            <Button onClick={resetErrorBoundary} variant="outlined">
              Thử kết nối lại
            </Button>
          </div>
        )}
      >
        <Suspense
          fallback={
            <div
              className={compact ? "loading compact" : "loading"}
              aria-busy="true"
              aria-label="Đang tải dữ liệu"
            >
              <Skeleton height={38} width="45%" />
              <Skeleton height={80} />
              <Skeleton variant="rounded" height={compact ? 80 : 280} />
            </div>
          }
        >
          {children}
        </Suspense>
      </ErrorBoundary>
    )}
  </QueryErrorResetBoundary>
);
