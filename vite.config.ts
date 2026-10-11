import { defineConfig, loadEnv } from "vite";

// Machine-specific addresses live in .env.local (never committed); see .env.example.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const strip = (prefix: string) => (p: string) => p.slice(prefix.length);
  const to = (prefix: string, target: string) => ({ [prefix]: { target, changeOrigin: true, rewrite: strip(prefix) } });

  return {
    base: "./",
    server: {
      host: true,
      port: 5188,
      strictPort: true,
      // Everything his mouth talks to is proxied here, so the browser never needs CORS.
      proxy: {
        ...to("/api/openai", "https://api.openai.com"),
        ...to("/api/anthropic", "https://api.anthropic.com"),
        ...to("/api/openrouter", "https://openrouter.ai"),
        ...to("/lm/local", env.LM_STUDIO_URL || "http://localhost:1235"),
        ...(env.LM_STUDIO_URL_2 ? to("/lm/2", env.LM_STUDIO_URL_2) : {}),
        // any OpenAI-style voice server: the Chatterbox one in voice/, or Kokoro-FastAPI
        ...to("/tts", env.VOICE_URL || "http://localhost:8880"),
      },
    },
    worker: { format: "es" as const },
    build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  };
});
