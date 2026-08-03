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
    
    // Gunakan 'gemini-1.5-flash' (Model Multimodal Cepat & Resmi)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Analisis foto layar kWh meteran listrik ini. 
      Ekstrak HANYA angka total kWh yang tertera pada layar digital.
      Format respon JSON wajib persis seperti ini tanpa teks lain:
      {"rawText": "1233.6", "cleanValue": 1233.6, "confidence": 95}
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
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Error di API /api/ocr:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses gambar pada server' },
      { status: 500 }
    );
  }
}
