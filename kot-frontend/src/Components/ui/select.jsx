import React, { useState, useRef, useEffect, createContext, useContext } from 'react';

const SelectContext = createContext();

export function Select({ children, value, onValueChange, ...props }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const ref = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <SelectContext.Provider value={{ isOpen, setIsOpen, value, onValueChange, selectedLabel, setSelectedLabel }}>
      <div className="relative" ref={ref} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className = '', ...props }) {
  const { isOpen, setIsOpen } = useContext(SelectContext);
  return (
    <button
      type="button"
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
      <svg className="h-4 w-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 9l5 5 5-5" />
      </svg>
    </button>
  );
}

export function SelectValue({ placeholder, displayValue, ...props }) {
  const { selectedLabel, value } = useContext(SelectContext);
  const safeValue = (typeof value === 'string' || typeof value === 'number') ? value : '';
  return <span {...props}>{displayValue || selectedLabel || safeValue || placeholder}</span>;
}

export function SelectContent({ children, className = '', ...props }) {
  const { isOpen } = useContext(SelectContext);
  if (!isOpen) return null;

  return (
    <div
      className={`absolute top-full z-50 min-w-[12rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-900 shadow-lg ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function SelectItem({ children, value, ...props }) {
  const { onValueChange, setIsOpen, value: selectedValue, setSelectedLabel } = useContext(SelectContext);
  const isSelected = value === selectedValue;

  const label =
    typeof children === 'string' || typeof children === 'number'
      ? children
      : React.isValidElement(children) && typeof children.props?.children === 'string'
        ? children.props.children
        : typeof children === 'object'
          ? children.label || children.name || children.displayName || children.id || ''
          : '';

  useEffect(() => {
    if (isSelected && label) {
      setSelectedLabel(label);
    }
  }, [isSelected, label, setSelectedLabel]);

  const rendered = React.isValidElement(children) ? children : <span>{label}</span>;

  return (
    <div
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground ${isSelected ? 'bg-accent text-accent-foreground' : ''}`}
      onClick={() => {
        onValueChange(value);
        if (label) setSelectedLabel(label);
        setIsOpen(false);
      }}
      {...props}
    >
      {rendered}
    </div>
  );
}
