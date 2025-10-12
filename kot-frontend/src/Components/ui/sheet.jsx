import React, { useState } from 'react';

export function Sheet({ children, open, onOpenChange }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => onOpenChange(false)} />
      )}
      {children}
    </>
  );
}

export function SheetTrigger({ children, asChild }) {
  return children;
}

export function SheetContent({ children, side = 'right', className = '' }) {
  const sideClasses = {
    left: 'left-0 top-0 h-full w-64',
    right: 'right-0 top-0 h-full w-64',
    top: 'top-0 left-0 w-full h-64',
    bottom: 'bottom-0 left-0 w-full h-64',
  };

  return (
    <div className={`fixed z-60 bg-white shadow-lg ${sideClasses[side]} ${className}`}>
      {children}
    </div>
  );
}
