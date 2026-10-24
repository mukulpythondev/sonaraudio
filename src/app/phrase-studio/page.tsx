import { Studio } from "@/components/studio";
import { fishConfig } from "@/lib/fish-config";

export const dynamic = "force-dynamic";

export default function PhraseStudio() {
  const config = fishConfig();
  return <Studio liveAvailable={config.ready} model={config.ready ? config.model : null} configurationMessage={config.ready ? null : config.message} />;
}
