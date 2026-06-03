import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { ReceiptPembayaranPayload } from '../../types/slipGaji';

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    color: '#4b5563',
    marginTop: 4,
  },
  companyName: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
  },
  card: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    width: 92,
    color: '#4b5563',
    marginRight: 6,
  },
  infoValue: {
    flex: 1,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: {
    flex: 1,
  },
  rowAmount: {
    width: 120,
    textAlign: 'right',
    fontWeight: 700,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#111827',
    padding: 12,
    marginTop: 4,
  },
  netRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  netLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  netAmount: {
    fontSize: 14,
    fontWeight: 700,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    color: '#4b5563',
  },
});

function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('id-ID', {
    maximumFractionDigits: 6,
  })}%`;
}

type ReceiptPembayaranDocumentProps = {
  payload: ReceiptPembayaranPayload;
};

export function ReceiptPembayaranDocument({
  payload,
}: ReceiptPembayaranDocumentProps) {
  return (
    <Document title={`Receipt Pembayaran ${payload.recipient.nama}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Receipt Pembayaran</Text>
            <Text style={styles.subtitle}>{payload.period.label}</Text>
          </View>
          <View>
            <Text style={styles.companyName}>{payload.companyName}</Text>
            <Text style={styles.subtitle}>
              {payload.recipient.jenisPenerima.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Penerima Penghasilan</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Nama</Text>
              <Text style={styles.infoValue}>{payload.recipient.nama}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>ID</Text>
              <Text style={styles.infoValue}>{payload.recipient.id}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>NIK/NPWP</Text>
              <Text style={styles.infoValue}>{payload.recipient.nik}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {payload.recipient.residentStatus} / {payload.recipient.statusIdentitas}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dokumen Dasar</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Dokumen</Text>
              <Text style={styles.infoValue}>{payload.document.type}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Nomor</Text>
              <Text style={styles.infoValue}>{payload.document.number}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Tanggal</Text>
              <Text style={styles.infoValue}>{payload.document.date}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Tanggal Potong</Text>
              <Text style={styles.infoValue}>{payload.document.withholdingDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Ringkasan Pembayaran & Pajak</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Bruto</Text>
            <Text style={styles.rowAmount}>{formatCurrency(payload.tax.gross)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              DPP / Deemed ({formatPercent(payload.tax.deemedPercent)})
            </Text>
            <Text style={styles.rowAmount}>{formatCurrency(payload.tax.taxBase)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>
              PPh Dipotong ({formatPercent(payload.tax.ratePercent)})
            </Text>
            <Text style={styles.rowAmount}>{formatCurrency(payload.tax.taxWithheld)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>TaxObjectCode</Text>
            <Text style={styles.rowAmount}>{payload.tax.taxObjectCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>TaxCertificate</Text>
            <Text style={styles.rowAmount}>{payload.tax.taxCertificate}</Text>
          </View>
          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net Dibayar</Text>
            <Text style={styles.netAmount}>{formatCurrency(payload.tax.netPaid)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Receipt ini bukan slip gaji pegawai tetap.</Text>
          <Text>Diterima oleh: ____________________</Text>
        </View>
      </Page>
    </Document>
  );
}

export default ReceiptPembayaranDocument;
