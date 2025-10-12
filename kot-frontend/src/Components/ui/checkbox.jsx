import React from 'react';

export function Checkbox({ checked, onCheckedChange, className = '', ...props }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={`h-4 w-4 rounded border border-primary text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 ${className}`}
      {...props}
    />
  );
}
