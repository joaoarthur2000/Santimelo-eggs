// Ícone e telas de abertura do app do painel (tela inicial do iPhone).
// Símbolo da Santimelo em Gema de Ovo sobre Terra Fértil: o inverso do app EGGS dos clientes,
// pra não confundir os dois no celular. Rodar: node scripts/gerar-icone-painel.mjs
// Trocou a arte? Suba VERSAO_ICONE em src/lib/app-painel.ts.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const TERRA = "#402924";
const ESCURO = "#2b1c15"; // cor do topo do painel: a abertura emenda na primeira tela
const GEMA = "#FFBD52";
const simbolo = readFileSync("public/eggs/icone.svg", "utf8").match(/<g fill="#402924"[\s\S]*<\/g>/)[0].replace("#402924", GEMA);
const svg = (fundo, raio = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="${raio}" fill="${fundo}"/>${simbolo}</svg>`;

const pasta = "public/app-painel";
mkdirSync(pasta, { recursive: true });
writeFileSync(`${pasta}/icone.svg`, svg(TERRA, 228));
// PNG sem canto arredondado: o iPhone e o Android recortam sozinhos
for (const [nome, lado] of [["apple-touch-icon", 180], ["icone-192", 192], ["icone-512", 512]]) {
  await sharp(Buffer.from(svg(TERRA)), { density: 300 }).resize(lado, lado).png({ compressionLevel: 9 }).toFile(`${pasta}/${nome}.png`);
}

// Telas de abertura: uma por tamanho de iPhone (largura × altura em pontos, densidade)
const TELAS = JSON.parse(readFileSync("src/lib/telas-iphone.json", "utf8"));
for (const [w, h, d] of TELAS) {
  const lado = Math.round(w * d * 0.34);
  const centro = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="202 202 620 620">${simbolo}</svg>`), { density: 300 }).resize(lado, lado).png().toBuffer();
  await sharp({ create: { width: w * d, height: h * d, channels: 3, background: ESCURO } })
    .composite([{ input: centro }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${pasta}/abertura-${w}x${h}-${d}x.png`);
}
