"use client";

import {useMemo, type ReactNode} from "react";
import {AppRouterCacheProvider} from "@mui/material-nextjs/v15-appRouter";
import {createTheme, ThemeProvider} from "@mui/material/styles";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import {prefixer} from "stylis";

export function MaterialTheme({rtl, children}: {rtl: boolean; children: ReactNode}) {
  const theme = useMemo(() => createTheme({
    direction: rtl ? "rtl" : "ltr",
    palette: {primary: {main: "#18475a"}, secondary: {main: "#286b60"}},
    shape: {borderRadius: 8},
    typography: {
      fontFamily: 'Inter, "Noto Sans Devanagari", "Noto Sans Gurmukhi", "Noto Sans Gujarati", "Noto Sans Tamil", system-ui, sans-serif',
      button: {textTransform: "none", fontWeight: 600},
    },
    components: {
      MuiButton: {
        defaultProps: {disableElevation: true},
        styleOverrides: {root: {minWidth: 0}, textPrimary: {color: "inherit"},
          containedPrimary: {backgroundColor: "var(--action-fill)", color: "var(--action-label)", "&:hover": {backgroundColor: "var(--action-hover)"}},
          outlinedPrimary: {color: "inherit", borderColor: "currentColor"}},
      },
      MuiButtonBase: {defaultProps: {disableRipple: true}},
      MuiOutlinedInput: {
        defaultProps: {size: "small"},
        styleOverrides: {root: {
          minWidth: 0, maxWidth: "100%", color: "inherit", font: "inherit",
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {borderColor: "var(--action-fill)"},
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {borderColor: "#ba303b"},
        }},
      },
      MuiTable: {defaultProps: {size: "small"}},
      MuiTableCell: {styleOverrides: {root: {color: "inherit", fontFamily: "inherit"}}},
      MuiCheckbox: {defaultProps: {size: "small"}, styleOverrides: {root: {padding: 3, color: "inherit", "&.Mui-checked": {color: "var(--action-fill)"}}}},
      MuiRadio: {defaultProps: {size: "small"}, styleOverrides: {root: {color: "inherit", "&.Mui-checked": {color: "var(--action-fill)"}}}},
      MuiSlider: {styleOverrides: {root: {color: "var(--action-fill)"}}},
    },
  }), [rtl]);
  return <AppRouterCacheProvider key={rtl ? "rtl" : "ltr"} options={rtl ? {key: "muirtl", stylisPlugins: [prefixer, rtlPlugin]} : {key: "mui"}}>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </AppRouterCacheProvider>;
}
