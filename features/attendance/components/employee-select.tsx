'use client';

import { useId, useRef, useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Employee } from '../types';

type Props = {
  employees: Employee[];
  value: Employee | null;
  onChange: (employee: Employee | null) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
};

export function EmployeeSelect({ employees, value, onChange, disabled, required, placeholder = 'Chọn nhân viên' }: Props) {
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | undefined>();
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  return <div className="form-field employee-select" ref={rootRef}>
    <label id={labelId}>Nhân viên{required && <span aria-hidden="true"> *</span>}</label>
    <div className="employee-select-control">
      <Popover open={open} onOpenChange={(next) => { if (next) setContainer(rootRef.current?.closest<HTMLElement>('[role="dialog"]') ?? undefined); setOpen(next); }}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-labelledby={labelId} aria-expanded={open} aria-required={required || undefined} disabled={disabled} className="employee-select-trigger">
            <span>{value ? `${value.employee_code} · ${value.full_name}` : placeholder}</span><ChevronsUpDown aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent container={container} align="start" className="employee-select-popover">
          <Command>
            <CommandInput aria-label="Tìm nhân viên" placeholder="Tìm theo mã hoặc họ tên" />
            <CommandList>
              <CommandEmpty>Không tìm thấy nhân viên</CommandEmpty>
              <CommandGroup>{employees.map((employee) => <CommandItem key={employee.id} value={`${employee.employee_code} · ${employee.full_name}`} data-checked={value?.id === employee.id} onSelect={() => { onChange(employee); setOpen(false); }}>{employee.employee_code} · {employee.full_name}</CommandItem>)}</CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && <Button type="button" variant="ghost" size="icon-sm" className="employee-select-clear" aria-label="Xóa nhân viên đã chọn" disabled={disabled} onClick={() => onChange(null)}><X aria-hidden="true" /></Button>}
    </div>
  </div>;
}
