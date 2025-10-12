import React from 'react';

export function Table({ children, className = '', ...props }) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={`w-full caption-bottom text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, ...props }) {
  return <thead {...props}>{children}</thead>;
}

export function TableBody({ children, ...props }) {
  return <tbody {...props}>{children}</tbody>;
}

export function TableRow({ children, ...props }) {
  return <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" {...props}>{children}</tr>;
}

export function TableHead({ children, ...props }) {
  return <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0" {...props}>{children}</th>;
}

export function TableCell({ children, ...props }) {
  return <td className="p-4 align-middle [&:has([role=checkbox])]:pr-0" {...props}>{children}</td>;
}
