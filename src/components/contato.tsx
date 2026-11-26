import { MessageCircle, Navigation, Phone } from "lucide-react";
import { linkLigar, linkRota, linkWhats } from "@/lib/contato";

type Cliente = { whatsapp?: string | null; lat?: number | null; lng?: number | null; endereco?: string | null; bairro?: string | null; cidade?: string | null };

/** Atalhos da rua (só no celular): chamar, ligar e traçar a rota. Aparece só o que o cadastro permite */
export function AcoesContato({ cliente, className = "" }: { cliente: Cliente; className?: string }) {
  const acoes = [
    { rotulo: "WhatsApp", href: linkWhats(cliente.whatsapp), icone: MessageCircle },
    { rotulo: "Ligar", href: linkLigar(cliente.whatsapp), icone: Phone },
    { rotulo: "Rota", href: linkRota(cliente), icone: Navigation },
  ].filter((a): a is typeof a & { href: string } => !!a.href);
  if (!acoes.length) return null;
  return (
    <div className={`flex gap-2 lg:hidden print:hidden ${className}`}>
      {acoes.map(({ rotulo, href, icone: I }) => (
        <a key={rotulo} href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer" className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-stone-200 bg-white text-[15px] font-medium text-marca-950 active:bg-stone-100">
          <I className="size-5 text-noz" strokeWidth={1.9} aria-hidden /> {rotulo}
        </a>
      ))}
    </div>
  );
}
