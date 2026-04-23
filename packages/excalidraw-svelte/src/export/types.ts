// Export Enhancements System for Phase 16 Feature 4

export type ExportFormat = 'svg' | 'png' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  width: number;
  height: number;
  scale: number;
  quality: number; // 0-1 for PNG
  includeBackground: boolean;
  includeBorder: boolean;
  borderWidth: number;
  borderColor: string;
  fileName: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  description?: string;
  format: ExportFormat;
  width: number;
  height: number;
  scale: number;
  quality: number;
}

export interface BatchExportConfig {
  enabled: boolean;
  formats: ExportFormat[];
  includeTimestamp: boolean;
  folderName: string;
}

export const getDefaultExportOptions = (): ExportOptions => ({
  format: 'svg',
  width: 1920,
  height: 1080,
  scale: 1,
  quality: 0.95,
  includeBackground: true,
  includeBorder: false,
  borderWidth: 8,
  borderColor: '#ffffff',
  fileName: `drawing-${Date.now()}`,
});

export const getDefaultBatchExportConfig = (): BatchExportConfig => ({
  enabled: false,
  formats: ['svg', 'png'],
  includeTimestamp: true,
  folderName: 'exports',
});

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'standard',
    name: 'Standard (1920×1080)',
    format: 'svg',
    width: 1920,
    height: 1080,
    scale: 1,
    quality: 0.95,
  },
  {
    id: 'hd',
    name: 'HD (1280×720)',
    format: 'png',
    width: 1280,
    height: 720,
    scale: 2,
    quality: 0.9,
  },
  {
    id: '4k',
    name: '4K (3840×2160)',
    format: 'png',
    width: 3840,
    height: 2160,
    scale: 2,
    quality: 0.95,
  },
  {
    id: 'thumbnail',
    name: 'Thumbnail (256×256)',
    format: 'png',
    width: 256,
    height: 256,
    scale: 1,
    quality: 0.85,
  },
  {
    id: 'square',
    name: 'Square (1024×1024)',
    format: 'png',
    width: 1024,
    height: 1024,
    scale: 1,
    quality: 0.9,
  },
  {
    id: 'print',
    name: 'Print (300 DPI, A4)',
    format: 'pdf',
    width: 2480,
    height: 3508,
    scale: 1,
    quality: 1,
  },
];

export const getFormatLabel = (format: ExportFormat): string => {
  const labels: Record<ExportFormat, string> = {
    svg: 'SVG (Scalable Vector)',
    png: 'PNG (Raster Image)',
    pdf: 'PDF (Document)',
    json: 'JSON (Data)',
  };
  return labels[format] || format.toUpperCase();
};

export const getFormatExtension = (format: ExportFormat): string => {
  const extensions: Record<ExportFormat, string> = {
    svg: '.svg',
    png: '.png',
    pdf: '.pdf',
    json: '.json',
  };
  return extensions[format] || '';
};

export const validateExportOptions = (options: ExportOptions): string | null => {
  if (options.width < 100 || options.width > 10000) {
    return 'Width must be between 100 and 10000 pixels';
  }
  if (options.height < 100 || options.height > 10000) {
    return 'Height must be between 100 and 10000 pixels';
  }
  if (options.scale < 0.1 || options.scale > 5) {
    return 'Scale must be between 0.1 and 5';
  }
  if (options.quality < 0 || options.quality > 1) {
    return 'Quality must be between 0 and 1';
  }
  if (!options.fileName.trim()) {
    return 'File name cannot be empty';
  }
  return null;
};

export const estimateFileSize = (options: ExportOptions, elementCount: number): string => {
  // Rough estimate based on format and complexity
  let bytes = 0;

  switch (options.format) {
    case 'svg':
      bytes = elementCount * 500 + options.width * options.height / 100;
      break;
    case 'png':
      bytes = options.width * options.height * 4 * (1 - options.quality * 0.5);
      break;
    case 'pdf':
      bytes = options.width * options.height / 10 + elementCount * 1000;
      break;
    case 'json':
      bytes = elementCount * 2000;
      break;
  }

  if (bytes < 1024) return Math.round(bytes) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};
