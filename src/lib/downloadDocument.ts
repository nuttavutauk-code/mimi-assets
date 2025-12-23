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