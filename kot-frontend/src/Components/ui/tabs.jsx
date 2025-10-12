import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext();

export function Tabs({ children, value, onValueChange, defaultValue, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue || value);

  const currentValue = value !== undefined ? value : internalValue;
  const setCurrentValue = onValueChange || setInternalValue;

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: setCurrentValue }}>
      <div {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '', ...props }) {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ children, value, className = '', ...props }) {
  const { value: currentValue, onValueChange } = useContext(TabsContext);
  const isActive = currentValue === value;

  return (
    <button
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'hover:bg-muted hover:text-foreground'
      } ${className}`}
      onClick={() => onValueChange(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ children, value, className = '', ...props }) {
  const { value: currentValue } = useContext(TabsContext);

  if (currentValue !== value) return null;

  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
