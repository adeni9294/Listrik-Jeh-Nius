export interface ValidationResult {
  validatedValue: number;
  confidence: number;
  correctionsMade: string[];
  requiresUserConfirmation: boolean;
}

export class AIValidationEngine {
  /**
   * Memperbaiki kesalahan pembacaan OCR umum (seperti huruf S -> 5, B -> 8, O -> 0)
   * dan memvalidasi logisnya angka terhadap histori pembacaan terakhir.
   */
  public static validate(
    rawText: string,
    ocrConfidence: number,
    lastReadingValue: number | null
  ): ValidationResult {
    const correctionsMade: string[] = [];
    let text = rawText.toUpperCase().trim();

    // Mapping Karakter OCR keliru -> Angka
    const substitutions: { [key: string]: string } = {
      'S': '5', 'B': '8', 'O': '0', 'Q': '0',
      'I': '1', 'L': '1', 'Z': '2', 'G': '6'
    };

    let correctedText = '';
    for (const char of text) {
      if (substitutions[char]) {
        correctedText += substitutions[char];
        correctionsMade.push(`Mengubah '${char}' menjadi '${substitutions[char]}'`);
      } else if (/[0-9.]/.test(char)) {
        correctedText += char;
      }
    }

    let parsedValue = parseFloat(correctedText) || 0;
    let finalConfidence = ocrConfidence;
    let requiresUserConfirmation = false;

    // Validasi berbasis histori
    if (lastReadingValue !== null && lastReadingValue > 0) {
      // Nilai meteran tidak boleh mundur secara tidak wajar
      if (parsedValue < lastReadingValue) {
        // Cek jika ada kemungkinan pergeseran desimal
        if (parsedValue * 10 >= lastReadingValue && parsedValue * 10 <= lastReadingValue + 100) {
          parsedValue = parsedValue * 10;
          correctionsMade.push('Disesuaikan skala puluhan berdasarkan histori');
        } else {
          finalConfidence -= 40;
          requiresUserConfirmation = true;
          correctionsMade.push('Peringatan: Nilai meteran lebih kecil dari pencatatan sebelumnya.');
        }
      }

      // Deteksi Anomali Pemakaian (> 50 kWh dalam sehari)
      const diff = parsedValue - lastReadingValue;
      if (diff > 50) {
        finalConfidence -= 30;
        requiresUserConfirmation = true;
        correctionsMade.push('Deteksi Lonjakan Ekstrem: Konsumsi melonjak drastis.');
      }
    }

    if (ocrConfidence < 60) {
      requiresUserConfirmation = true;
    }

    return {
      validatedValue: parsedValue,
      confidence: Math.max(0, Math.min(100, finalConfidence)),
      correctionsMade,
      requiresUserConfirmation,
    };
  }
}
