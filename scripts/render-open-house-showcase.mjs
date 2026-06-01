import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const width = 1280;
const height = 720;
const fps = 10;
const duration = 24;
const totalFrames = fps * duration;
const outDir = path.resolve('docs');
const outFile = path.join(outDir, 'open-house-payroll-showcase.webp');

const color = {
  bg: '#343434',
  navy: '#2F3061',
  blue: '#6CA6C1',
  yellow: '#FFE66D',
  off: '#F7FFF7',
  muted: '#B9C4BF',
  red: '#FFD5D5',
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ease(value) {
  value = clamp(value);
  return 1 - Math.pow(1 - value, 3);
}

function progress(t, start, end) {
  return clamp((t - start) / (end - start));
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text(value, x, y, size, fill = color.off, weight = 700, anchor = 'start') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="Consolas, ui-monospace, monospace">${esc(value)}</text>`;
}

function rect(x, y, w, h, r, fill, stroke = 'none', sw = 2, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${extra}/>`;
}

function pill(label, x, y, fill = color.blue, w = 150) {
  return [
    rect(x, y, w, 32, 16, `${fill}22`, `${fill}88`),
    text(label, x + 18, y + 22, 14, fill, 900),
  ].join('');
}

function metric(label, value, x, y, w, valueColor = color.off) {
  return [
    rect(x, y, w, 92, 18, 'rgba(20,20,24,0.7)', 'rgba(108,166,193,0.28)'),
    text(label, x + 20, y + 30, 13, 'rgba(247,255,247,0.55)', 900),
    text(value, x + 20, y + 66, 25, valueColor, 900),
  ].join('');
}

function frameShell(title = 'payroll-coretax.local') {
  return [
    rect(74, 72, 1132, 560, 28, 'rgba(47,48,97,0.94)', 'rgba(108,166,193,0.36)', 3),
    rect(74, 72, 1132, 54, 28, 'rgba(20,20,24,0.55)'),
    `<circle cx="104" cy="99" r="8" fill="${color.yellow}"/>`,
    `<circle cx="129" cy="99" r="8" fill="${color.blue}"/>`,
    `<circle cx="154" cy="99" r="8" fill="${color.off}" opacity="0.65"/>`,
    rect(194, 86, 270, 26, 13, 'rgba(247,255,247,0.08)'),
    text(title, 210, 105, 12, 'rgba(247,255,247,0.55)', 700),
  ].join('');
}

function cursor(x, y, p = 0) {
  const ring = p > 0.72
    ? `<circle cx="${x + 24}" cy="${y + 24}" r="${28 + 44 * (p - 0.72)}" fill="none" stroke="${color.yellow}" stroke-width="4" opacity="${1 - (p - 0.72) / 0.28}"/>`
    : '';
  return `${ring}<path d="M${x} ${y} L${x + 27} ${y + 65} L${x + 38} ${y + 37} L${x + 70} ${y + 35} Z" fill="${color.off}" stroke="${color.navy}" stroke-width="3"/>`;
}

function titleScene(t) {
  const p = ease(progress(t, 0, 3));
  const y = 150 - (1 - p) * 60;
  return [
    text('Taxeling', 90, y, 72, color.yellow, 1000),
    text('Payroll Coretax Workspace', 94, y + 82, 32, color.off, 900),
    text('Import Excel → Hitung PPh 21/26 → Audit → Export', 96, y + 132, 23, color.muted, 700),
    pill('PPh 21/26', 94, y + 184, color.blue, 130),
    pill('BPJS', 240, y + 184, color.yellow, 90),
    pill('XML BPMP', 345, y + 184, color.blue, 130),
    pill('Slip PDF', 490, y + 184, color.yellow, 120),
    `<g opacity="${p}">${frameShell()}${metric('Total Pajak', 'Rp 26.480.000', 760, 210, 290, color.yellow)}${metric('Total THP', 'Rp 512.990.000', 760, 322, 320, color.blue)}</g>`,
  ].join('');
}

function loginScene(t) {
  const p = ease(progress(t, 3, 7));
  const scan = 185 + p * 285;
  return [
    frameShell('taxeling.local/login'),
    text('Taxeling', 130, 200, 52, color.yellow, 1000),
    text('Internal Payroll', 132, 252, 27, color.off, 900),
    text('Akses terkontrol untuk payroll, pajak, dan dokumen.', 132, 294, 20, color.muted, 700),
    rect(760, 170, 320, 315, 24, 'rgba(247,255,247,0.92)'),
    text('Secure Login', 805, 225, 29, color.navy, 1000),
    rect(805, 275, 230, 42, 12, 'rgba(47,48,97,0.09)', 'rgba(47,48,97,0.16)'),
    text('user@company.com', 822, 302, 16, color.navy, 700),
    rect(805, 337, 230, 42, 12, 'rgba(47,48,97,0.09)', 'rgba(47,48,97,0.16)'),
    text('••••••••••', 822, 364, 16, color.navy, 700),
    rect(805, 405, 230, 48, 16, color.yellow),
    text('MASUK', 920, 436, 18, color.bg, 1000, 'middle'),
    `<line x1="760" y1="${scan}" x2="1080" y2="${scan}" stroke="${color.blue}" stroke-width="4" opacity="0.85"/>`,
    cursor(920, 410, p),
  ].join('');
}

function bulkScene(t) {
  const p = ease(progress(t, 7, 12));
  const rows = [
    ['A. Santoso', 'TETAP', 'GROSS', '18.500.000', '934.500', '14.825.000'],
    ['M. Rahayu', 'TETAP', 'NET', '21.200.000', '0', '18.940.000'],
    ['R. Wijaya', 'NON', 'GROSS_UP', '9.750.000', '488.000', '9.750.000'],
  ];
  return [
    frameShell('taxeling.local/bulk'),
    text('Bulk Payroll Matrix', 126, 180, 35, color.yellow, 1000),
    pill('Import Excel', 126, 225, color.blue, 135),
    pill('Recalculate', 278, 225, color.yellow, 140),
    pill('Finalize / Lock', 435, 225, color.yellow, 180),
    metric('Total Bruto', 'Rp 612.450.000', 126, 286, 230),
    metric('Total Pajak', 'Rp 26.480.000', 374, 286, 240, color.yellow),
    metric('Total THP', 'Rp 512.990.000', 632, 286, 250, color.blue),
    rect(126, 410, 970, 164, 20, 'rgba(20,20,24,0.64)', 'rgba(108,166,193,0.22)'),
    ['Nama', 'Tipe', 'Metode', 'Bruto', 'Pajak', 'THP'].map((h, i) => text(h, 155 + i * 158, 445, 14, 'rgba(247,255,247,0.5)', 900)).join(''),
    rows.map((row, r) => row.map((cell, c) => text(cell, 155 + c * 158, 486 + r * 36, 15, c === 4 ? color.yellow : c === 5 ? color.blue : color.off, c > 2 ? 900 : 700)).join('')).join(''),
    cursor(450 + p * 150, 232, p),
  ].join('');
}

function historyScene(t) {
  const p = ease(progress(t, 12, 17));
  const drawerX = 812 + (1 - p) * 420;
  return [
    frameShell('taxeling.local/history/detail'),
    text('Histori Periode Payroll', 126, 180, 35, color.yellow, 1000),
    metric('Karyawan', '38', 126, 238, 180),
    metric('Total Pajak', 'Rp 26.480.000', 326, 238, 260, color.yellow),
    metric('Total THP', 'Rp 512.990.000', 606, 238, 270, color.blue),
    pill('LOCKED', 900, 255, color.yellow, 125),
    rect(126, 382, 530, 168, 22, 'rgba(20,20,24,0.64)', 'rgba(108,166,193,0.22)'),
    text('Detail Hitungan', 154, 422, 24, color.blue, 1000),
    ['Membaca profil pajak', 'Menghitung BPJS', 'Menghitung bruto pajak'].map((s, i) => `${pill(`STEP ${i + 1}`, 154, 456 + i * 34, color.blue, 88)}${text(s, 258, 478 + i * 34, 15, color.off, 800)}`).join(''),
    rect(drawerX, 150, 330, 430, 24, color.navy, 'rgba(108,166,193,0.34)', 3),
    text('Export Snapshot', drawerX + 35, 205, 25, color.yellow, 1000),
    pill('XML BPMP', drawerX + 35, 250, color.blue, 130),
    pill('Semua Slip ZIP', drawerX + 180, 250, color.yellow, 145),
    pill('Slip PDF', drawerX + 35, 300, color.blue, 105),
    cursor(drawerX + 180, 313, p),
  ].join('');
}

function reconciliationScene(t) {
  const p = ease(progress(t, 17, 22));
  const rows = [
    ['A. Santoso', 'BERUBAH', '+Rp 2.300.000', '+Rp 116.000', '+Rp 1.820.000'],
    ['M. Rahayu', 'TETAP', 'Rp 0', 'Rp 0', 'Rp 0'],
    ['N. Putri', 'BARU', '+Rp 12.000.000', '+Rp 450.000', '+Rp 10.840.000'],
    ['D. Pratama', 'KELUAR', '-Rp 16.300.000', '-Rp 771.000', '-Rp 13.560.000'],
  ];
  return [
    frameShell('taxeling.local/history/reconcile'),
    text('Compare / Reconciliation', 126, 180, 35, color.yellow, 1000),
    text('Bulan ini vs bulan lalu sebelum lapor.', 128, 220, 21, color.muted, 700),
    metric('Delta Bruto', '+Rp 42.850.000', 126, 270, 260, color.blue),
    metric('Delta Pajak', '+Rp 2.105.000', 406, 270, 260, color.yellow),
    metric('Baru / Keluar', '3 / 1', 686, 270, 230),
    rect(126, 405, 970, 160, 20, 'rgba(20,20,24,0.64)', 'rgba(108,166,193,0.22)'),
    ['Karyawan', 'Status', 'Delta Bruto', 'Delta Pajak', 'Delta THP'].map((h, i) => text(h, 155 + i * 185, 438, 14, 'rgba(247,255,247,0.5)', 900)).join(''),
    rows.map((row, r) => {
      const visible = ease(p * 1.25 - r * 0.13);
      return `<g opacity="${visible}" transform="translate(0 ${22 * (1 - visible)})">${row.map((cell, c) => text(cell, 155 + c * 185, 475 + r * 30, 14, cell.includes('+') ? color.blue : cell.includes('-') ? color.red : c === 1 ? color.yellow : color.off, c === 1 ? 1000 : 800)).join('')}</g>`;
    }).join(''),
  ].join('');
}

function closingScene(t) {
  const p = ease(progress(t, 22, 24));
  return [
    text('Siap Demo di Booth', 640, 220 - (1 - p) * 40, 52, color.yellow, 1000, 'middle'),
    text('Open House Project', 640, 286 - (1 - p) * 32, 33, color.off, 900, 'middle'),
    text('Payroll lebih cepat ditinjau, mudah diaudit, dan siap export.', 640, 350, 22, color.muted, 700, 'middle'),
    rect(435, 425, 410, 58, 20, color.yellow),
    text('LIHAT DEMO LANGSUNG', 640, 463, 21, color.bg, 1000, 'middle'),
  ].join('');
}

function svgFrame(t) {
  const scene =
    t < 3.6 ? titleScene(t)
    : t < 7.2 ? loginScene(t)
    : t < 12.3 ? bulkScene(t)
    : t < 17.2 ? historyScene(t)
    : t < 22.2 ? reconciliationScene(t)
    : closingScene(t);

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <radialGradient id="glow" cx="78%" cy="8%" r="75%">
          <stop offset="0%" stop-color="${color.blue}" stop-opacity="0.28"/>
          <stop offset="55%" stop-color="${color.navy}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color.bg}" stop-opacity="0"/>
        </radialGradient>
        <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse" patternTransform="skewX(-22)">
          <path d="M 0 0 L 0 64" stroke="${color.blue}" stroke-opacity="0.12" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="${color.bg}"/>
      <rect width="100%" height="100%" fill="url(#glow)"/>
      <rect width="100%" height="100%" fill="url(#grid)"/>
      ${scene}
    </svg>
  `);
}

await fs.mkdir(outDir, { recursive: true });
const frames = [];
for (let i = 0; i < totalFrames; i += 1) {
  frames.push(svgFrame(i / fps));
}

await sharp(frames, { join: { animated: true } })
  .webp({
    delay: Math.round(1000 / fps),
    effort: 4,
    loop: 0,
    quality: 86,
  })
  .toFile(outFile);

const stats = await fs.stat(outFile);
console.log(`${outFile} ${stats.size}`);
