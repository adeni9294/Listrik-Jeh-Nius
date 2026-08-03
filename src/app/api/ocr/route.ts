import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  // Prefer Node.js Buffer if available (server runtime)
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(arrayBuffer).toString('base64');
  }

  // Fallback for edge / browser runtimes: convert in chunks to avoid call stack limits
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000; // 32KB chunk
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  // Last-resort: Node Buffer conversion for environments where Buffer exists but earlier check failed
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(binary, 'binary').toString('base64');
  }

  throw new Error('Tidak dapat mengonversi ArrayBuffer ke base64 di runtime ini');
}

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

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = arrayBufferToBase64(arrayBuffer);

    // Initialize client (some SDKs accept a string, others an object)
    let genAI: any;
    try {
      genAI = new (GoogleGenerativeAI as any)(apiKey);
    } catch (e) {
      genAI = new (GoogleGenerativeAI as any)({ apiKey });
    }

    // Get model instance if SDK exposes helper
    const model = typeof genAI.getGenerativeModel === 'function'
      ? genAI.getGenerativeModel({
          model: 'gemini-3.6-flash',
          generationConfig: {
            responseMimeType: 'application/json',
          },
        })
      : genAI;

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

    const payload = [
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: (file as Blob).type || 'image/jpeg',
        },
      },
    ];

    const result = await (typeof model.generateContent === 'function'
      ? model.generateContent(payload)
      : (model.generate ? model.generate(payload) : model));

    if (!result) {
      return NextResponse.json({ error: 'Tidak mendapatkan respons dari model.' }, { status: 502 });
    }

    // Extract text from various possible shapes
    let responseText = '';
    if (result.response) {
      const r = result.response;
      if (typeof r.text === 'function') {
        responseText = (await r.text()).trim();
      } else if (typeof r === 'string') {
        responseText = r.trim();
      } else if ((r as any).outputText) {
        responseText = String((r as any).outputText).trim();
      } else {
        responseText = JSON.stringify(r);
      }
    } else if (typeof result === 'string') {
      responseText = result.trim();
    } else if ((result as any).outputText) {
      responseText = String((result as any).outputText).trim();
    } else {
      try {
        responseText = JSON.stringify(result);
      } catch (e) {
        responseText = String(result);
      }
    }

    // Parse JSON
    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      console.error('Response dari model bukan JSON valid:', responseText);
      return NextResponse.json({ error: 'Response dari model tidak valid JSON', rawResponse: responseText }, { status: 502 });
    }

    // Normalize cleanValue jika berupa string
    if (parsedData && typeof parsedData.cleanValue === 'string') {
      const num = parseFloat(parsedData.cleanValue.replace(/[^0-9.,-]/g, '').replace(',', '.'));
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
