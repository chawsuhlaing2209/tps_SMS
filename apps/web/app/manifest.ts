import type { MetadataRoute } from "next";

// Manifest colors must be literal hex — it cannot read CSS variables.
// theme_color = --pds-color-spring-green-1000 (ink-green shell)
// background_color = --pds-color-spring-green-50 (frame)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SMS Platform",
    short_name: "SMS",
    description: "Multi-tenant school management system for Myanmar schools",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f7f1",
    theme_color: "#0a2a1d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
