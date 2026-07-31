import imageCompression from 'browser-image-compression';

export async function processAndCompressImage(file: File | Blob): Promise<Blob> {
  const options = {
    maxSizeMB: 0.3,            // Maksimal ukuran berkas 300KB
    maxWidthOrHeight: 1200,    // Maksimal resolusi 1200px
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.75,
  };

  try {
    const compressedFile = await imageCompression(file as File, options);
    return compressedFile;
  } catch (error) {
    console.error('Gagal mengompres gambar:', error);
    return file;
  }
}
