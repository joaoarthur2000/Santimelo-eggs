import { CONFIG, lerConfig, versaoDoApp } from "@/lib/config";

// O app pergunta isso de tempos em tempos: se a versão mudou, mostra o aviso de atualização
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ versao: versaoDoApp().id, novidades: (await lerConfig(CONFIG.NOVIDADES)) ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
