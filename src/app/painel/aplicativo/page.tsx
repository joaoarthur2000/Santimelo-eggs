import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { Cabecalho } from "@/components/ui";
import { ASSINATURA_EGGS } from "@/lib/constantes";
import { CONFIG, lerConfig, versaoDoApp } from "@/lib/config";
import { formatarDataCurta, formatarHora } from "@/lib/datas";
import { db } from "@/lib/db";
import { textoPedidoGrupo } from "@/lib/eggs";
import { linkDoApp } from "@/lib/rede";
import { ULTIMO_ENVIO, whatsappConectado } from "@/lib/whatsapp";
import { BotaoCopiar, BotaoTesteWhatsapp, FormAvisoTodos, FormManutencao, FormNovidades, FormWhatsappAtendimento } from "../forms";

export const metadata: Metadata = { title: "Aplicativo EGGS" };

/** Minutos desde a data (fora do componente: o relógio não é lido durante a renderização) */
const minutosDesde = (d: Date) => (Date.now() - d.getTime()) / 60000;

export default async function AplicativoEggs() {
  const link = linkDoApp();
  const versao = versaoDoApp();
  const [qr, manutencao, manutencaoTexto, novidades, clientes, ultimoEnvio, ultimoPedido, whatsAtendimento] = await Promise.all([
    QRCode.toString(link, { type: "svg", margin: 1, color: { dark: "#3d2614", light: "#ffffff" } }),
    lerConfig(CONFIG.MANUTENCAO),
    lerConfig(CONFIG.MANUTENCAO_TEXTO),
    lerConfig(CONFIG.NOVIDADES),
    db.cliente.findMany({ include: { usuario: true }, orderBy: { nomeFantasia: "asc" } }),
    lerConfig(ULTIMO_ENVIO),
    db.pedido.findFirst({ where: { origem: "APP" }, orderBy: { id: "desc" }, select: { id: true } }),
    lerConfig(CONFIG.WHATSAPP_ATENDIMENTO),
  ]);
  const whatsapp = whatsappConectado();
  const envio = ultimoEnvio ? (JSON.parse(ultimoEnvio) as { em: string; ok: boolean; erro?: string }) : null;
  const comanda = ultimoPedido ? await textoPedidoGrupo(ultimoPedido.id) : null;
  const local = !process.env.APP_URL;

  return (
    <>
      <Cabecalho titulo="Aplicativo EGGS" subtitulo="Como o cliente abre no celular, e o controle do app: avisos, manutenção e quem está usando." />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr] [&>*]:min-w-0">
        <section className="cartao p-5">
          <h2 className="font-semibold text-marca-950">Abrir no celular</h2>
          <div className="mx-auto mt-3 w-56" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-2 break-all text-center font-mono text-sm font-semibold">{link}</p>
          {local && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              Rodando no seu PC: só funciona com o celular <b>no mesmo Wi-Fi</b> e com o PC ligado e o sistema aberto. Pros clientes usarem de onde estiverem, o sistema precisa ir pra nuvem.
            </p>
          )}
          <h3 className="mt-5 text-sm font-semibold text-marca-950">Instalar no iPhone</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-stone-700">
            <li>Aponte a câmera pro QR code e abra no <b>Safari</b>.</li>
            <li>Entre com o código e a senha.</li>
            <li>Toque em <b>Compartilhar</b> (quadrado com seta pra cima).</li>
            <li>Escolha <b>Adicionar à Tela de Início</b> → Adicionar.</li>
            <li>Pronto: o ícone do EGGS fica na tela e abre em tela cheia, como app.</li>
          </ol>
          <h3 className="mt-4 text-sm font-semibold text-marca-950">No Android</h3>
          <p className="mt-1 text-sm text-stone-700">Abra no Chrome → menu ⋮ → <b>Instalar app</b> (ou Adicionar à tela inicial).</p>
        </section>

        <div className="space-y-6">
          <section className="cartao p-5">
            <h2 className="font-semibold text-marca-950">Atualizações</h2>
            <p className="mt-1 text-sm text-stone-600">
              Versão no ar: <span className="font-mono">{versao.id.slice(0, 8)}</span>
              {versao.em && ` · publicada ${formatarDataCurta(versao.em)} às ${formatarHora(versao.em)}`}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Quando o sistema é atualizado (novo build), todo celular com o app aberto mostra &quot;Tem novidade no EGGS&quot; com o texto abaixo e um botão pra atualizar.
            </p>
            <div className="mt-3">
              <FormNovidades texto={novidades ?? ""} />
            </div>
          </section>

          <section className={`cartao p-5 ${whatsapp ? "" : "ring-2 ring-amber-300"}`}>
            <h2 className="font-semibold text-marca-950">
              Grupo do WhatsApp EGGS-ADM{" "}
              {whatsapp ? <span className="text-marca-700">(conectado via {whatsapp === "zapi" ? "Z-API" : "Evolution API"})</span> : <span className="text-amber-700">(não conectado)</span>}
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Cada pedido feito no app manda a comanda pro grupo (e avisa quando o cliente cancela).
              {!whatsapp && " Falta conectar um número robô do WhatsApp (Z-API ou Evolution API) no .env. Até lá, copie a comanda abaixo e cole no grupo."}
            </p>
            {envio && (
              <p className={`mt-2 text-sm ${envio.ok ? "text-marca-700" : "text-red-700"}`}>
                Último envio: {formatarDataCurta(new Date(envio.em))} às {formatarHora(new Date(envio.em))} · {envio.ok ? "entregue" : `falhou (${envio.erro})`}
              </p>
            )}
            {whatsapp && (
              <div className="mt-3">
                <BotaoTesteWhatsapp />
              </div>
            )}
            {comanda && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-marca-950">Último pedido do app, como chega no grupo</h3>
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-sans text-sm text-stone-800 ring-1 ring-stone-200">{comanda}</pre>
                <div className="mt-2">
                  <BotaoCopiar texto={comanda} />
                </div>
              </>
            )}
          </section>

          <section className={`cartao p-5 ${whatsAtendimento ? "" : "ring-2 ring-amber-300"}`}>
            <h2 className="mb-1 font-semibold text-marca-950">WhatsApp do atendimento</h2>
            <p className="mb-3 text-xs text-stone-500">
              Número da Santimelo que o chat do Guinho (aba Ajuda do app) abre no WhatsApp, com o assunto já escrito.
              {!whatsAtendimento && " Sem número, o cliente só consegue pedir que a equipe chame."}
            </p>
            <FormWhatsappAtendimento numero={whatsAtendimento ?? ""} />
          </section>

          <section className="cartao p-5">
            <h2 className="mb-1 font-semibold text-marca-950">Aviso pra todos os clientes</h2>
            <p className="mb-3 text-xs text-stone-500">Aparece no início do app de cada cliente com acesso ativo.</p>
            <FormAvisoTodos assinatura={ASSINATURA_EGGS} />
          </section>

          <section className={`cartao p-5 ${manutencao === "1" ? "ring-2 ring-red-500" : ""}`}>
            <h2 className="mb-1 font-semibold text-marca-950">Manutenção {manutencao === "1" && <span className="text-red-700">(ligada: app fora do ar)</span>}</h2>
            <FormManutencao ligada={manutencao === "1"} texto={manutencaoTexto ?? ""} />
          </section>

          <section className="cartao overflow-x-auto">
            <h2 className="px-4 pt-4 font-semibold text-marca-950">Quem está usando</h2>
            <table className="mt-2 w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Código</th>
                  <th className="px-4 py-2">Último acesso</th>
                  <th className="px-4 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {clientes.map((c) => {
                  const u = c.usuario;
                  const travado = u?.bloqueadoAte && minutosDesde(u.bloqueadoAte) < 0;
                  const online = u?.ultimoAcesso && minutosDesde(u.ultimoAcesso) < 10;
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-2">
                        <Link href={`/painel/clientes/${c.id}`} className="hover:underline">{c.nomeFantasia}</Link>
                      </td>
                      <td className="px-4 py-2 font-mono">{u?.codigoAcesso ?? "—"}</td>
                      <td className="px-4 py-2">
                        {online ? <span className="font-semibold text-marca-700">usando agora</span> : u?.ultimoAcesso ? `${formatarDataCurta(u.ultimoAcesso)} ${formatarHora(u.ultimoAcesso)}` : "nunca entrou"}
                      </td>
                      <td className="px-4 py-2">{!u ? "sem acesso" : !u.ativo ? "bloqueado" : travado ? <span className="text-red-700">travado (senha errada)</span> : "ativo"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </>
  );
}
