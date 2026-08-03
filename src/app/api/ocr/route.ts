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
    const file = formData.get('image') as Blob;

    if (!file) {
      return NextResponse.json(
        { error: 'Tidak ada file gambar yang dikirim.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Menggunakan model Vision yang stabil & cepat
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        responseMimeType: 'application/json', // Memaksa output murni berbentuk JSON
      },
    });

    const prompt = `
      Analisis foto layar kWh meteran listrik PLN ini. 
      Ekstrak HANYA angka total kWh yang tertera pada layar digital/analog.
      
      Kembalikan JSON dengan struktur persis seperti ini:
      {
        "rawText": "1233.6",
        "cleanValue": 1233.6,
        "confidence": 95
      }
      
      Catatan:
      - rawText: Teks asli angka yang terbaca.
      - cleanValue: Tipe data Float/Number dari angka kWh.
      - confidence: Estimasi tingkat kepastian pembacaan (0-100).
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'image/jpeg',
        },
      },
    ]);

    const responseText = result.response.text().trim();
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error di API /api/ocr:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses gambar pada server' },
      { status: 500 }
    );
  }
}
