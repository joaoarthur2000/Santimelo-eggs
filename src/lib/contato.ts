// Links que abrem o app certo no celular: WhatsApp, ligação e rota no mapa

const so = (numero: string | null | undefined) => (numero ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

export function linkWhats(numero: string | null | undefined) {
  const n = so(numero);
  return n.length >= 10 ? `https://wa.me/55${n}` : null;
}

export function linkLigar(numero: string | null | undefined) {
  const n = so(numero);
  return n.length >= 10 ? `tel:+55${n}` : null;
}

type Lugar = { lat?: number | null; lng?: number | null; endereco?: string | null; bairro?: string | null; cidade?: string | null };

/** Rota até o cliente: pela posição exata, se tiver; senão pelo endereço escrito */
export function linkRota(c: Lugar) {
  const destino = c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : c.endereco ? [c.endereco, c.bairro, c.cidade].filter(Boolean).join(", ") : null;
  return destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}` : null;
}
