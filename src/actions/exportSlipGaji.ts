import { pdf, type DocumentProps } from '@react-pdf/renderer';
import JSZip from 'jszip';
import { createElement, type ReactElement } from 'react';
import ReceiptPembayaranDocument from '../components/slip/ReceiptPembayaranDocument';
import SlipGajiDocument from '../components/slip/SlipGajiDocument';
import { applyNominalOverrides } from '../lib/payrollOverrides';
import {
  ReceiptPembayaranPayload,
  SlipGajiLineItem,
  SlipGajiPayload,
  SlipGajiSource,
} from '../types/slipGaji';

function formatPeriodLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1);
  const label = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatPeriodStamp(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function sumLineItems(items: SlipGajiLineItem[]): number {
  return items.reduce((total, item) => total + item.amount, 0);
}

function pushLineItem(
  target: SlipGajiLineItem[],
  item: Omit<SlipGajiLineItem, 'category'> & { category: SlipGajiLineItem['category'] }
): void {
  if (!Number.isFinite(item.amount) || item.amount <= 0) return;
  target.push(item);
}

export function buildSlipGajiPayload(source: SlipGajiSource): SlipGajiPayload {
  const { namaPerusahaan, bulan, tahun, karyawan, hasil } = source;
  const input = applyNominalOverrides(source.input);

  if (karyawan.tipeKaryawan !== 'TETAP') {
    throw new Error(`Slip gaji PDF hanya tersedia untuk pegawai TETAP: ${karyawan.namaLengkap}`);
  }

  const penerimaan: SlipGajiLineItem[] = [];
  const potongan: SlipGajiLineItem[] = [];
  const informational: SlipGajiLineItem[] = [];

  pushLineItem(penerimaan, {
    label: 'Gaji Pokok',
    amount: input.gajiPokok,
    category: 'penerimaan',
    affectsTakeHome: true,
  });
  pushLineItem(penerimaan, {
    label: 'Tunjangan Tetap',
    amount: input.tunjanganTetap,
    category: 'penerimaan',
    affectsTakeHome: true,
  });
  pushLineItem(penerimaan, {
    label: 'Lembur / Variabel',
    amount: input.tunjanganVariabel,
    category: 'penerimaan',
    affectsTakeHome: true,
  });
  pushLineItem(penerimaan, {
    label: 'THR / Bonus',
    amount: input.thrAtauBonus,
    category: 'penerimaan',
    affectsTakeHome: true,
  });
  pushLineItem(penerimaan, {
    label: 'Refund Pajak',
    amount: hasil.refundPajak,
    category: 'penerimaan',
    affectsTakeHome: true,
  });

  if (karyawan.metodePajak === 'GROSS_UP') {
    pushLineItem(penerimaan, {
      label: 'Tunjangan PPh 21',
      amount: hasil.tunjanganPajakGrossUp,
      category: 'penerimaan',
      affectsTakeHome: true,
    });
  }

  pushLineItem(potongan, {
    label: 'JHT Karyawan',
    amount: hasil.iuranJhtKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'JP Karyawan',
    amount: hasil.iuranJpKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'BPJS Kesehatan Karyawan',
    amount: hasil.iuranBpjsKesKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'Iuran Pensiun Karyawan',
    amount: hasil.iuranPensiunKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'DPLK Karyawan',
    amount: hasil.potonganDplkKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'Zakat',
    amount: hasil.potonganZakat,
    category: 'potongan',
    affectsTakeHome: true,
  });
  pushLineItem(potongan, {
    label: 'PPh 21 Dipotong',
    amount: hasil.pajakDipotongDariKaryawan,
    category: 'potongan',
    affectsTakeHome: true,
  });

  pushLineItem(informational, {
    label: 'JKK Perusahaan',
    amount: hasil.premiJkkPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'JKM Perusahaan',
    amount: hasil.premiJkmPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'JHT Perusahaan',
    amount: hasil.premiJhtPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'JP Perusahaan',
    amount: hasil.premiJpPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'BPJS Kesehatan Perusahaan',
    amount: hasil.premiBpjsKesPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'Premi Asuransi Swasta Perusahaan',
    amount: input.premiAsuransiSwastaPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'Iuran Pensiun Perusahaan',
    amount: input.iuranPensiunPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'DPLK Perusahaan',
    amount: input.dplkPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'Natura Taxable',
    amount: input.naturaTaxable,
    category: 'informational',
    affectsTakeHome: false,
  });
  pushLineItem(informational, {
    label: 'PPh 21 Ditanggung Perusahaan',
    amount: hasil.pajakDitanggungPerusahaan,
    category: 'informational',
    affectsTakeHome: false,
  });

  return {
    companyName: namaPerusahaan.trim() || 'Perusahaan',
    period: {
      month: bulan,
      year: tahun,
      label: formatPeriodLabel(bulan, tahun),
    },
    employee: {
      employeeId: karyawan.idKaryawan?.trim() || karyawan.nik,
      nik: karyawan.nik,
      nama: karyawan.namaLengkap,
      jabatan: karyawan.jabatan?.trim() || 'Pegawai',
      cabang: '-',
      divisi: '-',
      metodePajak: karyawan.metodePajak,
      residentStatus: karyawan.residentStatus,
      statusIdentitas: karyawan.statusIdentitas,
    },
    penerimaan,
    potongan,
    informational,
    totals: {
      totalPenerimaan: sumLineItems(penerimaan),
      totalPotongan: sumLineItems(potongan),
      thp: hasil.thpBersih,
    },
  };
}

function resolveReceiptWithholdingDate(source: SlipGajiSource): string {
  const lastDay = new Date(source.tahun, source.bulan, 0).getDate();
  return (
    source.karyawan.bp21?.withholdingDate ||
    source.karyawan.bp26?.withholdingDate ||
    `${source.tahun}-${String(source.bulan).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  );
}

function resolveReceiptDocument(source: SlipGajiSource): ReceiptPembayaranPayload['document'] {
  const bp21 = source.karyawan.bp21;
  const bp26 = source.karyawan.bp26;

  return {
    type: bp21?.documentType || bp26?.documentType || '-',
    number: bp21?.documentNumber || bp26?.documentNumber || '-',
    date: bp21?.documentDate || bp26?.documentDate || '-',
    withholdingDate: resolveReceiptWithholdingDate(source),
    idTkuPenerima: bp21?.idTkuPenerima || '-',
  };
}

function resolveReceiptTax(source: SlipGajiSource): ReceiptPembayaranPayload['tax'] {
  const { karyawan, hasil } = source;
  const gross = Math.max(0, Math.floor(hasil.totalBruto));
  const isNonResident = karyawan.residentStatus === 'NON_RESIDENT';
  const deemedPercent = isNonResident
    ? karyawan.bp26?.deemed ?? 100
    : karyawan.bp21?.deemedPersentase ?? 50;
  const taxBase = Math.max(0, Math.floor((gross * deemedPercent) / 100));
  const taxWithheld = Math.max(0, Math.floor(hasil.pajakTerutang));
  const ratePercent =
    typeof karyawan.bp26?.rate === 'number'
      ? karyawan.bp26.rate
      : gross > 0
        ? (taxWithheld / gross) * 100
        : 0;

  return {
    taxObjectCode:
      karyawan.bp21?.taxObjectCode ||
      karyawan.bp26?.taxObjectCode ||
      (isNonResident ? '27-100-99' : '-'),
    taxCertificate:
      karyawan.bp21?.taxCertificate ||
      karyawan.bp26?.taxCertificate ||
      karyawan.fasilitasPajak ||
      'N/A',
    deemedPercent,
    ratePercent,
    gross,
    taxBase,
    taxWithheld,
    netPaid: Math.max(0, Math.floor(hasil.thpBersih)),
  };
}

export function buildReceiptPembayaranPayload(
  source: SlipGajiSource
): ReceiptPembayaranPayload {
  const { namaPerusahaan, bulan, tahun, karyawan } = source;

  if (karyawan.tipeKaryawan === 'TETAP') {
    throw new Error(`Receipt PDF hanya tersedia untuk bukan pegawai: ${karyawan.namaLengkap}`);
  }

  return {
    companyName: namaPerusahaan.trim() || 'Perusahaan',
    period: {
      month: bulan,
      year: tahun,
      label: formatPeriodLabel(bulan, tahun),
    },
    recipient: {
      id: karyawan.idKaryawan?.trim() || karyawan.nik,
      nik: karyawan.counterpartTin?.trim() || karyawan.nik,
      nama: karyawan.namaLengkap,
      residentStatus: karyawan.residentStatus,
      statusIdentitas: karyawan.statusIdentitas,
      metodePajak: karyawan.metodePajak,
      jenisPenerima: karyawan.tipeKaryawan,
    },
    tax: resolveReceiptTax(source),
    document: resolveReceiptDocument(source),
  };
}

export async function generateSlipGajiPdfBlob(
  payload: SlipGajiPayload
): Promise<Blob> {
  const documentElement = createElement(SlipGajiDocument, {
    payload,
  }) as unknown as ReactElement<DocumentProps>;
  const instance = pdf(documentElement);
  return instance.toBlob();
}

export async function generateReceiptPembayaranPdfBlob(
  payload: ReceiptPembayaranPayload
): Promise<Blob> {
  const documentElement = createElement(ReceiptPembayaranDocument, {
    payload,
  }) as unknown as ReactElement<DocumentProps>;
  const instance = pdf(documentElement);
  return instance.toBlob();
}

export function buildSlipGajiFilename(source: SlipGajiSource): string {
  const period = formatPeriodStamp(source.bulan, source.tahun);
  const employeeId = sanitizeFilenamePart(
    source.karyawan.idKaryawan?.trim() || source.karyawan.nik
  );
  const employeeName = sanitizeFilenamePart(source.karyawan.namaLengkap);
  return `SlipGaji_${period}_${employeeId}_${employeeName}.pdf`;
}

export function buildReceiptPembayaranFilename(source: SlipGajiSource): string {
  const period = formatPeriodStamp(source.bulan, source.tahun);
  const recipientId = sanitizeFilenamePart(
    source.karyawan.idKaryawan?.trim() || source.karyawan.nik
  );
  const recipientName = sanitizeFilenamePart(source.karyawan.namaLengkap);
  return `ReceiptPembayaran_${period}_${recipientId}_${recipientName}.pdf`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadSlipGajiPdf(
  source: SlipGajiSource
): Promise<void> {
  const payload = buildSlipGajiPayload(source);
  const blob = await generateSlipGajiPdfBlob(payload);
  downloadBlob(blob, buildSlipGajiFilename(source));
}

export async function downloadReceiptPembayaranPdf(
  source: SlipGajiSource
): Promise<void> {
  const payload = buildReceiptPembayaranPayload(source);
  const blob = await generateReceiptPembayaranPdfBlob(payload);
  downloadBlob(blob, buildReceiptPembayaranFilename(source));
}

export async function downloadAllSlipGajiZip(
  sources: SlipGajiSource[],
  bulan: number,
  tahun: number
): Promise<void> {
  if (sources.length === 0) {
    throw new Error('Tidak ada slip gaji yang bisa diunduh pada periode ini.');
  }

  const zip = new JSZip();

  for (const source of sources) {
    const payload = buildSlipGajiPayload(source);
    const blob = await generateSlipGajiPdfBlob(payload);
    const buffer = await blob.arrayBuffer();
    zip.file(buildSlipGajiFilename(source), buffer);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `SlipGaji_${formatPeriodStamp(bulan, tahun)}.zip`);
}
