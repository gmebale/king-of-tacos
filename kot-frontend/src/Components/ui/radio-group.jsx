import React, { createContext, useContext, useState } from 'react';

const RadioGroupContext = createContext();

export function RadioGroup({ children, value, onValueChange, defaultValue, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue || value);

  const currentValue = value !== undefined ? value : internalValue;
  const setCurrentValue = onValueChange || setInternalValue;

  return (
    <RadioGroupContext.Provider value={{ value: currentValue, onValueChange: setCurrentValue }}>
      <div {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function RadioGroupItem({ value, id, ...props }) {
  const { value: currentValue, onValueChange } = useContext(RadioGroupContext);

  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={currentValue === value}
      onChange={() => onValueChange(value)}
      className="h-4 w-4 rounded border border-primary text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
      {...props}
    />
  );
}
