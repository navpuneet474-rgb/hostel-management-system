import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/auth": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/student": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/staff": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/security": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/maintenance": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/chat": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
            "/login": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true,
            },
        },
    },
});
