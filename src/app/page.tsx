import { SceneStudio } from "@/components/scene-studio";
import { sceneFishConfig } from "@/lib/fish-config";
import { DEFAULT_GEMINI_MODEL, geminiConfig } from "@/lib/gemini";
import { cloudflareConfig, cloudflareConfigured, DEFAULT_CLOUDFLARE_MODEL } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = sceneFishConfig();
  const gemini = geminiConfig();
  const cloudflare = cloudflareConfig();
  const workers = cloudflareConfigured();
  const writer = workers ? cloudflare : gemini;
  return (
    <SceneStudio
      fishReady={config.ready}
      fishMessage={config.ready ? null : config.message}
      draftReady={writer.ready}
      draftMessage={writer.ready ? null : writer.message}
      draftModel={writer.ready ? writer.model : workers ? DEFAULT_CLOUDFLARE_MODEL : DEFAULT_GEMINI_MODEL}
      draftProvider={workers ? "Cloudflare Workers AI" : "Gemini"}
      audioReady={cloudflare.ready}
      audioMessage={cloudflare.ready ? null : cloudflare.message}
    />
  );
}
