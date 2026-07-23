"use client";

import { FileText } from 'lucide-react';
import { useState } from 'react';

interface PdfFile {
  title: string;
  fileName: string;
  description: string;
}

interface PdfListProps {
  pdfFiles: PdfFile[];
}

export default function PdfList({ pdfFiles }: PdfListProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="mt-10 pt-8 border-t border-gray-700">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Available PDFs
        </h2>
        <p className="text-gray-400 text-sm mt-2">Click to view each document in a new tab</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pdfFiles.map((pdf, index) => (
          <div 
            key={index} 
            className="relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <a
              href={`/api/media/pdfs/${pdf.fileName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 bg-gray-900 border border-gray-700 rounded-lg hover:border-purple-500 hover:bg-gray-800 transition-all duration-200 group shadow-md hover:shadow-purple-500/30 hover:shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 bg-purple-600/20 rounded-md group-hover:bg-purple-600/30 transition-colors">
                  <FileText className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white group-hover:text-purple-300 transition-colors mb-1">{pdf.title}</h3>
                  <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">Click to view PDF</p>
                </div>
              </div>
            </a>

            {hoveredIndex === index && pdf.description && (
              <div className="absolute z-10 left-0 right-0 top-full mt-2 p-4 bg-gray-950 border border-purple-500/50 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-600/20 rounded-md">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-2">{pdf.title}</h4>
                    <p className="text-sm text-gray-300 leading-relaxed">{pdf.description}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
