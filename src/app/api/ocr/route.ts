import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY belum dikonfigurasi di Server.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as Blob | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Tidak ada file gambar yang dikirim.' },
        { status: 400 }
      );
    }

    // Konversi file Blob ke Buffer -> Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // Inisialisasi SDK Gemini dengan model gemini-2.5-flash
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    // PROMPT DENGAN INSTRUKSI DESIMAL PLN
    const prompt = `
      Analisis foto layar kWh meteran listrik PLN prabayar/pascabayar ini.
      Ekstrak angka sisa/total kWh yang tertera pada layar digital LCD.

      ATURAN KHUSUS MEMBACA METERAN PLN:
      1. Tanda strip (-) atau titik (.) pada LCD (contoh: "1233-60" atau "1233.60") ADALAH TITIK DESIMAL (KOMA).
      2. Jangan menggabungkan angka di belakang strip/titik menjadi ribuan.
      3. Contoh: Jika di layar tertulis "1233-60", hasilnya harus "1233.6" atau "1233.60". BUKAN 123360.

      Kembalikan JSON dengan struktur persis seperti ini:
      {
        "rawText": "1233.6",
        "cleanValue": 1233.6,
        "confidence": 95
      }

      Aturan Field:
      - rawText: Teks asli angka yang terbaca (gunakan titik untuk desimal).
      - cleanValue: Tipe data Float/Number murni (contoh: 1233.6).
      - confidence: Estimasi tingkat kepastian pembacaan (0-100).
    `;

    const mimeType = file.type || 'image/jpeg';
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    let responseText = result.response.text();

    if (!responseText) {
      return NextResponse.json(
        { error: 'Tidak mendapatkan respons dari model.' },
        { status: 502 }
      );
    }

    // Pembersihan Markdown Code Block jika dikembalikan oleh model
    const cleanJsonString = responseText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(cleanJsonString);
    } catch (e) {
      console.error('Response dari model bukan JSON valid:', responseText);
      return NextResponse.json(
        { error: 'Response dari model tidak valid JSON', rawResponse: responseText },
        { status: 502 }
      );
    }

    // Normalisasi cleanValue jika terbalik dikirimkan sebagai string
    if (parsedData && typeof parsedData.cleanValue === 'string') {
      const num = parseFloat(
        parsedData.cleanValue.replace('-', '.').replace(/[^0-9.]/g, '')
      );
      parsedData.cleanValue = Number.isFinite(num) ? num : parsedData.cleanValue;
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error di API /api/ocr:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses gambar pada server' },
      { status: 500 }
    );
  }
}
