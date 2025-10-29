/**
 * src/features/manual/components/FormControls.tsx
 * Shared form/table utilities used across manual data cards (depots, relief points, etc.).
 */
import { useMemo } from 'react';

import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface LabeledInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  placeholder?: string;
}

export function LabeledInput({ id, label, value, onChange, type = 'text', placeholder }: LabeledInputProps): JSX.Element {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

export interface DataTableProps {
  headers: (string | JSX.Element)[];
  rows: (string | number | JSX.Element | null | undefined)[][];
  emptyMessage?: string;
}

export function DataTable({ headers, rows, emptyMessage }: DataTableProps): JSX.Element {
  const headerValues = useMemo(() => headers, [headers]);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headerValues.map((headerCell, index) => (
            <TableHead key={index}>{headerCell}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, columnIndex) => (
              <TableCell key={`${rowIndex}-${columnIndex}`}>{cell as any}</TableCell>
            ))}
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={headerValues.length} className="text-center text-sm text-muted-foreground">
              {emptyMessage ?? 'まだ行がありません'}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export function clampInt(text: string, min: number, max: number, fallback: number): number {
  const numeric = Number.parseInt(String(text), 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function toNumber(text: string, fallback: number): number {
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : fallback;
}
