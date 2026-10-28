"use client";
import { useState, type FC, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { SnackbarProvider } from "@/hooks/use-mui-snackbar";

const theme = createTheme({
  palette: {
    primary: { main: "#216344" },
    background: { default: "#f6f8f5" },
    text: { primary: "#21392f", secondary: "#63746b" },
  },
  typography: {
    fontFamily: '"Noto Sans Variable", Arial, sans-serif',
    button: { textTransform: "none", fontWeight: 600, fontSize: 13 },
  },
  shape: { borderRadius: 9 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTextField: { defaultProps: { size: "small" } },
  },
});
const Providers: FC<PropsWithChildren> = ({ children }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ThemeProvider theme={theme}>
      <QueryClientProvider client={client}>
        <SnackbarProvider>{children}</SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};
export default Providers;
