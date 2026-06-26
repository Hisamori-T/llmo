import { HTMLAttributes, ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';

// Wraps the native <table>. Place inside a Card with overflow:hidden for the outer border/radius.
export function Table({ className = '', children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full ${className}`.trim()} {...props}>
      {children}
    </table>
  );
}

// thead: surface-subtle background + border-b at the bottom of the header section.
export function Thead({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-surface-subtle border-b border-border ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

// tbody: no extra style; row borders are applied per-Tr.
export function Tbody({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

// Tr: row divider only. hover must be added via className by the caller
// (thead rows and tbody rows differ in hover expectation).
// Example tbody usage: <Tr className="hover:bg-surface-hover transition-colors">
export function Tr({ className = '', children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b border-border-divider last:border-0 ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

// Th: left-aligned header cell. Override with className="text-right" for action columns.
export function Th({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`text-left py-[11px] px-[18px] text-[12px] font-semibold text-ink-500 tracking-[.02em] ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

// Td: primary data cell (14px / medium / ink-700).
// For secondary data (13.5px / #5E5A51) add className="text-[13.5px] font-normal text-ink-600".
// For muted meta data (dates) add className="text-[13.5px] text-ink-500".
export function Td({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`py-[13px] px-[18px] text-[14px] font-medium text-ink-700 ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}
