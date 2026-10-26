#!/usr/bin/env node
/*
 * Genera la imagen de Instagram de cada noticia de Al dIA (identidad v2, logo del robot).
 *
 * Uso:  node herramientas/generar.js <spec.json>
 *
 * spec.json:
 * {
 *   "fecha": "2026-10-26",
 *   "posts": [{
 *     "n": 1,
 *     "etiqueta": "Voz con IA",                 // tema, 1-3 palabras
 *     "empresa": "Block",                        // va en la etiqueta blanca del panel
 *     "logo_empresa": "https://…/icon.png",      // opcional: ícono pequeño para esa etiqueta
 *     "visual": {"tipo": "foto|icono|logo", "url": "https://…", "zoom": 1.4},
 *     "grande": false,                           // true solo si la imagen tiene detalle (escena, personas, producto, captura)
 *     "titular": "Block presenta <em>Dessa</em>, …",   // <em> = palabra clave en plateado
 *     "bajada": "2 o 3 frases que expliquen la noticia",
 *     "fuente": "block.xyz/dessa"
 *   }]
 * }
 *
 * Sale: <fecha>/aldia-<fecha>-<n>.jpg (1080×1350, JPEG) dentro del repo.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const LOGO = path.join(RAIZ, 'marca', 'aldia-logo-v2.png');
const FUENTE = path.join(RAIZ, 'fonts', 'Nunito-Variable.ttf');
const USUARIO = '@ald.ia.news';

const C = {
  perla: '#E6E5E3', niebla: '#D8D8D8', nube: '#F7F6F3', luz: '#F8EEE2',
  plata: '#A8A8A8', grafito: '#414245', visor: '#141414',
};

const css = () => `
@font-face{font-family:'Nunito';src:url('file://${FUENTE}');font-weight:200 1000;}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px}
body{position:relative;overflow:hidden;color:${C.visor};font-family:'Nunito',sans-serif;
  background:radial-gradient(110% 75% at 50% 0%,${C.nube} 0%,${C.perla} 55%,${C.niebla} 100%);
  padding:72px 76px;display:flex;flex-direction:column}
body:before{content:'';position:absolute;inset:-20%;pointer-events:none;
  background:linear-gradient(118deg,transparent 38%,rgba(248,238,226,.85) 48%,rgba(228,216,204,.35) 54%,transparent 64%)}
body>*{position:relative}
.top{display:flex;justify-content:space-between;align-items:center}
.marca{display:flex;align-items:center;gap:18px;font-weight:900;font-size:38px;letter-spacing:.2px}
.marca img{width:76px;height:76px;border-radius:50%;box-shadow:0 6px 18px rgba(20,20,20,.12)}
.visor{display:inline-flex;align-items:center;gap:14px;background:${C.visor};color:${C.nube};
  border-radius:999px;padding:14px 26px 14px 20px;font-weight:800;font-size:24px;letter-spacing:2px;text-transform:uppercase}
.ojos{display:inline-flex;gap:7px}
.ojos i{display:block;width:9px;height:22px;border-radius:9px;background:${C.nube}}
.panel{position:relative;margin-top:44px;flex:50 1 auto;min-height:520px;border-radius:48px;overflow:hidden;
  background:radial-gradient(90% 90% at 30% 20%,#2A2B2E 0%,${C.visor} 70%);
  box-shadow:0 30px 70px rgba(20,20,20,.25),inset 0 0 0 2px rgba(255,255,255,.06);
  display:flex;align-items:center;justify-content:center}
.panel:after{content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(118deg,transparent 35%,rgba(248,238,226,.16) 47%,transparent 60%)}
.panel img.foto{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:contrast(1.12) brightness(1.15) saturate(1.1)}
.panel img.logo{max-width:58%;max-height:46%;filter:brightness(0) invert(1)}
.panel img.icono{width:340px;height:340px;object-fit:contain;border-radius:76px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 2px rgba(255,255,255,.08)}
.panel .velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,20,20,0) 55%,rgba(20,20,20,.65) 100%)}
.panel .chip{position:absolute;left:30px;bottom:30px;display:flex;align-items:center;gap:12px;background:${C.nube};
  border-radius:999px;padding:12px 24px 12px 14px;font-weight:800;font-size:26px;z-index:2}
.panel .chip img{width:34px;height:34px;object-fit:contain}
.panel .chip .ojos i{background:${C.visor};width:8px;height:20px}
.titular{text-wrap:balance;font-weight:900;font-size:68px;line-height:1.02;letter-spacing:-1.4px;margin-top:44px}
.titular em{font-style:normal;background:linear-gradient(100deg,${C.grafito} 0%,${C.plata} 55%,${C.grafito} 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.bajada{font-weight:500;font-size:31px;line-height:1.36;margin-top:22px;color:${C.grafito}}
.compacta .panel{flex:none;height:380px;min-height:0}
.compacta .panel img.icono{width:230px;height:230px;border-radius:52px}
.compacta .titular{font-size:92px;line-height:1.0;letter-spacing:-2px;margin-top:auto;padding-top:56px}
.compacta .bajada{font-size:34px;margin-top:30px}
.spacer{flex:1}
.pie{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:24px;color:${C.grafito}}
.pie .sw{font-weight:900;letter-spacing:3px;color:${C.visor}}
`;

const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// En titular solo se permite <em>…</em>
const titularSeguro = (t) => esc(t).replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>');

/** Descarga una imagen a la carpeta temporal y devuelve su ruta local (Chromium no siempre sigue redirecciones de otros sitios). */
function descargar(url, destino) {
  if (!url) return '';
  if (!/^https?:\/\//.test(url)) return path.resolve(url);
  try {
    execFileSync('curl', ['-fsSL', '--max-time', '30', '-A', 'AlDiaGenerador/1.0 (+https://github.com/estebanortizgo/aldia-media)', '-o', destino, url]);
  } catch (error) {
    throw new Error(`No pude descargar ${url}: ${String(error.stderr || error.message).trim()}`);
  }
  // Solo acepta imágenes de verdad (PNG, JPEG, GIF, WebP o SVG), no páginas de error
  const inicio = fs.readFileSync(destino).subarray(0, 256);
  const texto = inicio.toString('utf8').trimStart();
  const esImagen = inicio[0] === 0x89 || (inicio[0] === 0xff && inicio[1] === 0xd8) || texto.startsWith('GIF8')
    || (texto.startsWith('RIFF') && inicio.subarray(8, 12).toString() === 'WEBP') || /^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg/i.test(texto);
  if (!esImagen) throw new Error(`Lo que bajó de ${url} no es una imagen (empieza con: ${JSON.stringify(texto.slice(0, 60))})`);
  return destino;
}

function html(post, tmp) {
  const v = post.visual || {};
  const img = descargar(v.url, path.join(tmp, `visual-${post.n}${path.extname(new URL(v.url || 'https://x/a.jpg').pathname) || '.img'}`));
  const logoEmpresa = post.logo_empresa ? descargar(post.logo_empresa, path.join(tmp, `logo-${post.n}${path.extname(new URL(post.logo_empresa).pathname) || '.img'}`)) : '';
  const dentro = {
    foto: `<img class="foto" style="transform:scale(${Number(v.zoom) || 1})" src="file://${img}"><div class="velo"></div>`,
    icono: `<img class="icono" src="file://${img}">`,
    logo: `<img class="logo" src="file://${img}">`,
  }[v.tipo] || '';
  const marcaEmpresa = logoEmpresa ? `<img src="file://${logoEmpresa}">` : '<span class="ojos"><i></i><i></i></span>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css()}</style></head>
<body class="${post.grande ? '' : 'compacta'}">
<div class="top"><div class="marca"><img src="file://${LOGO}">Al dIA</div>
<span class="visor"><span class="ojos"><i></i><i></i></span>${esc(post.etiqueta)}</span></div>
<div class="panel">${dentro}<div class="chip">${marcaEmpresa}${esc(post.empresa)}</div></div>
<div class="titular">${titularSeguro(post.titular)}</div><p class="bajada">${esc(post.bajada)}</p><div style="height:48px"></div>
<div class="spacer"></div>
<div class="pie"><span>Fuente: ${esc(post.fuente)}</span><span class="sw">${USUARIO}</span></div></body></html>`;
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const salida = path.join(RAIZ, spec.fecha);
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aldia-'));
  fs.mkdirSync(salida, { recursive: true });
  const { chromium } = require('playwright');
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
  for (const post of spec.posts) {
    const archivoHtml = path.join(tmp, `post-${post.n}.html`);
    fs.writeFileSync(archivoHtml, html(post, tmp));
    await pagina.goto(`file://${archivoHtml}`, { waitUntil: 'load' });
    await pagina.evaluate(() => document.fonts.ready);
    const rotas = await pagina.evaluate(() => [...document.images].filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
    if (rotas.length) throw new Error(`Post ${post.n}: no cargaron estas imágenes: ${rotas.join(', ')}`);
    const destino = path.join(salida, `aldia-${spec.fecha}-${post.n}.jpg`);
    await pagina.screenshot({ path: destino, type: 'jpeg', quality: 90 });
    console.log(destino);
  }
  await navegador.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
