import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { meterNumber } = await request.json();

    if (!meterNumber || meterNumber.trim().length < 5) {
      return NextResponse.json(
        { error: 'Nomor meter atau ID pelanggan tidak boleh kosong dan harus valid.' },
        { status: 400 }
      );
    }

    // SIMULASI INKUIRI KE API PPOB / PLN
    // Di sini Anda nantinya dapat menyambungkan ke API provider seperti Digiflazz / Ayopop.
    // Berdasarkan standar PLN, kita bisa melakukan parsing atau mengambil data dari server.
    
    // Contoh logika deteksi otomatis berdasarkan panjang atau pola nomor meter:
    let detectedPower = 11000; // Default B2
    let segmentInfo = 'B2 - Bisnis Menengah (Tegangan Rendah)';

    // Contoh: Jika nomor meter diawali angka tertentu atau simulasi khusus 33000 VA
    if (meterNumber.startsWith('14') || meterNumber.length >= 12) {
      detectedPower = 33000;
      segmentInfo = 'B2 - Bisnis Besar / Toko Modern (33 kVA)';
    } else if (meterNumber.startsWith('5')) {
      detectedPower = 6600;
      segmentInfo = 'B2 - Bisnis Kecil (6.6 kVA)';
    }

    const plnResult = {
      success: true,
      data: {
        meterNumber: meterNumber.trim(),
        customerName: `PELANGGAN PLN (${meterNumber.slice(-4)})`,
        powerVa: detectedPower,
        segment: segmentInfo,
        status: 'ACTIVE'
      }
    };

    return NextResponse.json(plnResult);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Gagal terhubung ke server inkuiri PLN.' },
      { status: 500 }
    );
  }
}
