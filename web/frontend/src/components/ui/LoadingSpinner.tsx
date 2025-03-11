import { Loader2 } from 'lucide-react';
import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export default function LoadingSpinner({
  size = 'md',
  label,
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className={`${sizeMap[size]} text-blue-600 animate-spin mb-2`} />
      {label && <p className="text-gray-600 text-sm">{label}</p>}
    </div>
  );
}
