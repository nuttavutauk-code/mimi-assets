/**
 * ดาวน์โหลดเอกสารหลายหน้าเป็น PNG แยกไฟล์
 * หา element `[id^="document-page-"]` ทั้งหมด, capture แต่ละหน้าแยกกัน
 * แต่ละหน้าตั้งชื่อ `{filename}-page-{n}.png` (single page → `{filename}.png`)
 */
export async function downloadDocumentPages(
    elementId: string,
    filename: string,
    maxWaitMs: number = 5000
): Promise<{ success: boolean; pages: number }> {
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

    if (pageEls.length === 0) {
        // fallback: single root capture
        try {
            const html2canvas = (await import("html2canvas")).default;
            const canvas = await html2canvas(root, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                allowTaint: true,
            } as any);
            const link = document.createElement("a");
            link.download = `${filename}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            return { success: true, pages: 1 };
        } catch (e) {
            console.error("Error generating fallback image:", e);
            return { success: false, pages: 0 };
        }
    }

    try {
        const html2canvas = (await import("html2canvas")).default;

        for (let i = 0; i < pageEls.length; i++) {
            const canvas = await html2canvas(pageEls[i], {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
                logging: false,
                allowTaint: true,
            } as any);
            const link = document.createElement("a");
            link.download = pageEls.length > 1 ? `${filename}-page-${i + 1}.png` : `${filename}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            await new Promise((r) => setTimeout(r, 200));
        }
        return { success: true, pages: pageEls.length };
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