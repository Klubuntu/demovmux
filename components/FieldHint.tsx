'use client';
import { useState } from 'react';

interface Props { text: string; }

export default function FieldHint({ text }: Props) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center ml-1 shrink-0"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center cursor-help hover:bg-blue-100 hover:text-blue-600 transition-colors select-none">
        ?
      </span>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl z-50 leading-snug pointer-events-none whitespace-normal">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}
