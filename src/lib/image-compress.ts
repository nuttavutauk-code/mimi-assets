// lib/image-compress.ts
// Utility สำหรับ Compress รูปภาพก่อน Upload
// ลดขนาดไฟล์จาก ~3MB เหลือ ~300-500KB อัตโนมัติ

export interface CompressOptions {
  maxWidth?: number;      // ความกว้างสูงสุด (default: 1920)
  maxHeight?: number;     // ความสูงสูงสุด (default: 1440)
  quality?: number;       // คุณภาพ 0-1 (default: 0.7)
  maxSizeMB?: number;     // ขนาดไฟล์สูงสุด MB (default: 1)
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1440,
  quality: 0.7,
  maxSizeMB: 1,
};

/**
 * Compress รูปภาพก่อน Upload
 * @param file - ไฟล์รูปภาพต้นฉบับ
 * @param options - ตัวเลือกการ compress
 * @returns Promise<File> - ไฟล์ที่ถูก compress แล้ว
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // ถ้าไม่ใช่รูปภาพ ส่งกลับไฟล์เดิม
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // ถ้าไฟล์เล็กกว่า maxSizeMB อยู่แล้ว ไม่ต้อง compress
  const maxSizeBytes = (opts.maxSizeMB || 1) * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    console.log(`[Compress] File already small: ${(file.size / 1024 / 1024).toFixed(2)} MB - skipping compression`);
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // คำนวณขนาดใหม่
        let { width, height } = img;
        const maxW = opts.maxWidth || 1920;
        const maxH = opts.maxHeight || 1440;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // สร้าง Canvas และวาดรูป
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // วาดรูปลงใน canvas
        ctx.drawImage(img, 0, 0, width, height);

        // แปลงเป็น Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to compress image"));
              return;
            }

            // สร้าง File ใหม่ โดยใช้ชื่อไฟล์เดิม
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            const originalSize = (file.size / 1024 / 1024).toFixed(2);
            const newSize = (compressedFile.size / 1024 / 1024).toFixed(2);
            const reduction = (((file.size - compressedFile.size) / file.size) * 100).toFixed(0);

            console.log(`[Compress] ${originalSize} MB → ${newSize} MB (ลด ${reduction}%)`);

            resolve(compressedFile);
          },
          "image/jpeg",
          opts.quality
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compress รูปภาพหลายไฟล์พร้อมกัน
 * @param files - Array ของไฟล์รูปภาพ
 * @param options - ตัวเลือกการ compress
 * @returns Promise<File[]> - Array ของไฟล์ที่ถูก compress แล้ว
 */
export async function compressImages(
  files: File[],
  options: CompressOptions = {}
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)));
}