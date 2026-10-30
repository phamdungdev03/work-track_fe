'use client';
import { Children, isValidElement, useId, type ChangeEvent, type ReactNode } from 'react';
import { Input } from './input';
import { Textarea } from './textarea';
import { NativeSelect } from './native-select';

type FieldProps = {
  label: string;
  value: string | number;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onFocus?: () => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  fullWidth?: boolean;
  select?: boolean;
  multiline?: boolean;
  minRows?: number;
  children?: ReactNode;
  helperText?: string;
  slotProps?: { inputLabel?: { shrink?: boolean }; htmlInput?: { maxLength?: number; step?: number }; input?: { startAdornment?: ReactNode } };
};

export function FormField({ label, value, onChange, onFocus, type, placeholder, disabled, required, autoFocus, select, multiline, minRows, children, helperText, slotProps }: FieldProps) {
  const id = useId();
  const hasEmptyOption = Children.toArray(children).some((child) => isValidElement<{ value?: string | number }>(child) && child.props.value === '');
  const common = { id, value, disabled, required, autoFocus, 'aria-describedby': helperText ? `${id}-help` : undefined, onChange, onFocus };
  return <div className="form-field">
    <label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>
    {select ? <NativeSelect className="w-full" {...common}>{!hasEmptyOption && <option value="" disabled>Chọn {label.toLowerCase()}</option>}{children}</NativeSelect> : multiline ? <Textarea {...common} placeholder={placeholder} rows={minRows} maxLength={slotProps?.htmlInput?.maxLength} /> : <div className="field-input-wrap">{slotProps?.input?.startAdornment}<Input {...common} type={type} placeholder={placeholder} step={slotProps?.htmlInput?.step} maxLength={slotProps?.htmlInput?.maxLength}/></div>}
    {helperText && <small id={`${id}-help`}>{helperText}</small>}
  </div>;
}
