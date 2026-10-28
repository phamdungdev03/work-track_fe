"use client";
import { Alert, Snackbar } from "@mui/material";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";

type Severity = "success" | "error" | "warning" | "info";
const SnackbarContext = createContext<
  (message: string, severity?: Severity) => void
>(() => undefined);
export const SnackbarProvider: FC<PropsWithChildren> = ({ children }) => {
  const [notice, setNotice] = useState<{
    id: number;
    message: string;
    severity: Severity;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const nextId = useRef(0);
  const show = useCallback(
    (message: string, severity: Severity = "info") => {
      setNotice({ id: ++nextId.current, message, severity });
      setOpen(true);
    },
    [],
  );
  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {notice && <Snackbar
        key={notice.id}
        open={open}
        autoHideDuration={5000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={notice.severity}
          onClose={() => setOpen(false)}
          variant="filled"
        >
          {notice.message}
        </Alert>
      </Snackbar>}
    </SnackbarContext.Provider>
  );
};
export function useMuiSnackbar() {
  return useContext(SnackbarContext);
}
