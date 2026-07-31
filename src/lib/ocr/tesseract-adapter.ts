import { createWorker } from 'tesseract.js';
import { IOCREngine, OCRResult } from './ocr-interface';

export class TesseractOCREngine implements IOCREngine {
  async processImage(imageSource: Blob | File | HTMLCanvasElement): Promise<OCRResult> {
    const worker = await createWorker('eng');
    
    // Terapkan whitelist karakter angka dan titik
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
    });

    const ret = await worker.recognize(imageSource);
    await worker.terminate();

    const rawText = ret.data.text.trim();
    // Bersihkan karakter non-numerik
    const numericOnly = rawText.replace(/[^0-9.]/g, '');
    const cleanValue = numericOnly ? parseFloat(numericOnly) : null;

    return {
      rawText,
      cleanValue,
      confidence: ret.data.confidence,
    };
  }
}
