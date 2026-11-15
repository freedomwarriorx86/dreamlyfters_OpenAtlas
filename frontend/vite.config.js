import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development /api is proxied to the FastAPI backend (override with OPENATLAS_API).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": { target: process.env.OPENATLAS_API || "http://localhost:8000", changeOrigin: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 3000, // aladin-lite ships its WebAssembly inlined (loaded lazily)
  },
});
