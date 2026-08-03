import { createWorker, Worker } from 'tesseract.js';
import { IOCREngine, OCRResult } from './ocr-interface';

export class TesseractOCREngine implements IOCREngine {
  private static workerPromise: Promise<Worker> | null = null;

  // Re-use 1 Worker yang sama agar tidak perlu load/terminate berulang kali
  private async getWorker(): Promise<Worker> {
    if (!TesseractOCREngine.workerPromise) {
      TesseractOCREngine.workerPromise = (async () => {
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.',
          tessedit_pageseg_mode: '7' as any, // PSM 7: Anggap gambar sebagai 1 baris teks tunggal (Sangat Cepat!)
        });
        return worker;
      })();
    }
    return TesseractOCREngine.workerPromise;
  }

  async processImage(imageSource: Blob | File | HTMLCanvasElement): Promise<OCRResult> {
    const worker = await this.getWorker();

    // Jalankan pengenalan teks tanpa terminate worker
    const ret = await worker.recognize(imageSource);

    const rawText = ret.data.text.trim();
    const numericOnly = rawText.replace(/[^0-9.]/g, '');
    const cleanValue = numericOnly ? parseFloat(numericOnly) : null;

    return {
      rawText,
      cleanValue,
      confidence: ret.data.confidence,
    };
  }
}
