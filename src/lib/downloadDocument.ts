/**
 * แปลง canvas เป็น Blob (แทนที่จะเป็น data URL ที่มือถือหลายรุ่นจัดการไม่ได้ดี)
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

/**
 * ส่งไฟล์ให้ผู้ใช้: ใช้ Web Share API ก่อน (เปิด share sheet ให้ "บันทึกรูปภาพ" บนมือถือ
 * ได้อย่างน่าเชื่อถือกว่าการ click ลิงก์ดาวน์โหลดที่มาจากโค้ด async)
 * ถ้าเบราว์เซอร์ไม่รองรับ หรือ share ถูก reject ด้วยเหตุผลอื่นที่ไม่ใช่ผู้ใช้ยกเลิกเอง
 * จะ fallback ไปดาวน์โหลดผ่าน Blob URL ตามปกติ
 */
async function shareOrDownloadFiles(
    files: { blob: Blob; filename: string }[]
): Promise<{ success: boolean; cancelled?: boolean }> {
    const shareFiles = files.map(
        ({ blob, filename }) => new File([blob], filename, { type: "image/png" })
    );

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: shareFiles })) {
        try {
            await navigator.share({ files: shareFiles });
            return { success: true };
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                return { success: true, cancelled: true };
            }
            // ไม่รองรับ/ถูก reject ด้วยเหตุผลอื่น -> fallback ไปดาวน์โหลดแบบปกติด้านล่าง
        }
    }

    for (const { blob, filename } of files) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = filename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { success: true };
}

/**
 * ดาวน์โหลดเอกสารหลายหน้าเป็น PNG แยกไฟล์
 * หา element `[id^="document-page-"]` ทั้งหมด, capture แต่ละหน้าแยกกัน
 * แต่ละหน้าตั้งชื่อ `{filename}-page-{n}.png` (single page → `{filename}.png`)
 */
export async function downloadDocumentPages(
    elementId: string,
    filename: string,
    maxWaitMs: number = 5000
): Promise<{ success: boolean; pages: number; cancelled?: boolean }> {
    const root = await waitForElement(elementId, maxWaitMs);
    if (!root) {
        console.error(`Element with id "${elementId}" not found`);
        return { success: false, pages: 0 };
    }

    const pageEls = Array.from(
        root.querySelectorAll<HTMLElement>('[id^="document-page-"]')
    ).sort((a, b) => {
        const an = parseInt(a.getAttribute("data-page-number") || "0", 10);
        const bn = parseInt(b.getAttribute("data-page-number") || "0", 10);
        return an - bn;
    });

    const targets = pageEls.length > 0 ? pageEls : [root];

    try {
        const html2canvas = (await import("html2canvas")).default;

        const files: { blob: Blob; filename: string }[] = [];
        for (let i = 0; i < targets.length; i++) {
            const canvas = await html2canvas(targets[i], {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                allowTaint: true,
            } as any);
            const blob = await canvasToBlob(canvas);
            if (!blob) continue;
            const pageFilename =
                targets.length > 1 ? `${filename}-page-${i + 1}.png` : `${filename}.png`;
            files.push({ blob, filename: pageFilename });
        }

        if (files.length === 0) {
            return { success: false, pages: 0 };
        }

        const result = await shareOrDownloadFiles(files);
        return { ...result, pages: files.length };
    } catch (error) {
        console.error("Error generating pages:", error);
        return { success: false, pages: 0 };
    }
}

/**
 * ดาวน์โหลด Element เป็นรูปภาพ PNG
 * ใช้ html2canvas + workaround สำหรับ vertical-align
 */
export async function downloadAsImage(elementId: string, filename: string, maxWaitMs: number = 5000): Promise<boolean> {
  // ✅ รอจนกว่า element จะปรากฏ (max 5 วินาที)
  const element = await waitForElement(elementId, maxWaitMs);

  if (!element) {
    console.error(`Element with id "${elementId}" not found after ${maxWaitMs}ms`);
    return false;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;

    // ✅ ใช้ html2canvas โดยตรงกับ element
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      allowTaint: true,
    } as any);

    const imageData = canvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.download = `${filename}.png`;
    link.href = imageData;
    link.click();

    return true;
  } catch (error) {
    console.error("Error generating image:", error);
    return false;
  }
}

/**
 * ฟังก์ชันรอจนกว่า element จะปรากฏ
 */
async function waitForElement(elementId: string, maxWaitMs: number = 5000): Promise<HTMLElement | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const element = document.getElementById(elementId);
    if (element) {
      // รอเพิ่มอีก 100ms ให้ render เสร็จสมบูรณ์
      await new Promise(resolve => setTimeout(resolve, 100));
      return element;
    }
    // รอ 100ms แล้วลองใหม่
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}

/**
 * ดาวน์โหลด Element เป็นรูปภาพ JPEG
 */
export async function downloadAsJpeg(
  elementId: string,
  filename: string,
  quality: number = 0.9
): Promise<boolean> {
  const element = document.getElementById(elementId);

  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return false;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      allowTaint: true,
    } as any);

    const imageData = canvas.toDataURL("image/jpeg", quality);

    const link = document.createElement("a");
    link.download = `${filename}.jpg`;
    link.href = imageData;
    link.click();

    return true;
  } catch (error) {
    console.error("Error generating image:", error);
    return false;
  }
}

/**
 * แปลง Element เป็น Base64 Image
 */
export async function elementToBase64(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);

  if (!element) {
    console.error(`Element with id "${elementId}" not found`);
    return null;
  }

  try {
    const html2canvas = (await import("html2canvas")).default;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    } as any);

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}