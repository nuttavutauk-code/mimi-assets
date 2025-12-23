import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ===== Performance Optimizations =====
  
  // เปิด compression สำหรับ response
  compress: true,
  
  // ปิด x-powered-by header (เพิ่มความปลอดภัย)
  poweredByHeader: false,
  
  // เปิด React Strict Mode (ช่วยหา bugs)
  reactStrictMode: true,
  
  // Optimize images
  images: {
    // formats ที่รองรับ
    formats: ["image/avif", "image/webp"],
    // cache รูปนาน 1 ปี
    minimumCacheTTL: 31536000,
  },
  
  // Experimental features
  experimental: {
    // Optimize package imports
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "date-fns",
      "framer-motion",
    ],
  },
};

export default nextConfig;
