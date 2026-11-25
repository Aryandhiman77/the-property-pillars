"use client";

import Checkbox from "@mui/material/Checkbox";
import InputBase from "@mui/material/InputBase";
import Radio from "@mui/material/Radio";
import NativeSelect from "@mui/material/NativeSelect";
import OutlinedInput from "@mui/material/OutlinedInput";
import type {ComponentProps} from "react";

function isInvalid(value: ComponentProps<"input">["aria-invalid"]) {
  return Boolean(value && value !== "false");
}

// Keep names, constraint validation, DOM refs and event handlers on the actual
// control. Both dashboard forms and public forms read these via the browser APIs.
export function MaterialInput({ref, value, defaultValue, type, disabled, required, readOnly, ...input}: ComponentProps<"input">) {
  if (type === "checkbox" || type === "radio") {
    const Control = type === "checkbox" ? Checkbox : Radio;
    const {checked, defaultChecked, onChange, id, name, autoFocus, tabIndex, ...attributes} = input;
    return <Control id={id} name={name} autoFocus={autoFocus} tabIndex={tabIndex} readOnly={readOnly} checked={checked} defaultChecked={defaultChecked} disabled={disabled} required={required}
      value={value} onChange={onChange} slotProps={{input: {...attributes, ref}}} />;
  }
  if (type === "file") {
    return <InputBase className="material-file" inputRef={ref} inputProps={input}
      type="file" disabled={disabled} required={required} />;
  }
  return <OutlinedInput className="material-field" inputRef={ref} inputProps={input}
    type={type} value={value} defaultValue={defaultValue} disabled={disabled} required={required}
    readOnly={readOnly} error={isInvalid(input["aria-invalid"])} />;
}

export function MaterialTextarea({ref, value, defaultValue, disabled, required, readOnly, ...input}: ComponentProps<"textarea">) {
  return <OutlinedInput className="material-field material-textarea" inputComponent="textarea" inputRef={ref}
    inputProps={input} value={value} defaultValue={defaultValue} disabled={disabled} required={required}
    readOnly={readOnly} error={isInvalid(input["aria-invalid"])} />;
}

export function MaterialSelect({ref, children, value, defaultValue, disabled, required, ...input}: ComponentProps<"select">) {
  return <NativeSelect className="material-field" variant="outlined" inputRef={ref}
    input={<OutlinedInput error={isInvalid(input["aria-invalid"])} />} inputProps={input}
    value={value} defaultValue={defaultValue} disabled={disabled} required={required}>
    {children}
  </NativeSelect>;
}
