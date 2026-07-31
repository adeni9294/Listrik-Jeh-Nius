export interface OCRResult {
  rawText: string;
  cleanValue: number | null;
  confidence: number;
}

export interface IOCREngine {
  processImage(imageSource: Blob | File | HTMLCanvasElement): Promise<OCRResult>;
}
