import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada gambar yang diunggah' }, { status: 400 });
    }

    // Konversi Blob gambar ke ArrayBuffer -> Base64
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');

    // Gunakan Gemini 2.5 Flash / Lite (Multimodal)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
      Analisis foto layar kWh meteran listrik ini. 
      Tugas utama: Ekstrak HANYA angka total kWh yang tertera pada layar digital.
      Format respon JSON wajib persis seperti ini:
      {"rawText": "15420.5", "cleanValue": 15420.5, "confidence": 95}
      Jangan kirimkan teks penjelasan lain selain JSON tersebut.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type || 'image/webp',
        },
      },
    ]);

    const responseText = result.response.text().trim();
    
    // Cleaning output JSON jika ada format markdown ```json
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Gemini OCR Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses gambar dengan AI' },
      { status: 500 }
    );
  }
}
