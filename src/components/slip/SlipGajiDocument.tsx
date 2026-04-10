import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { SlipGajiLineItem, SlipGajiPayload } from '../../types/slipGaji';

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
  titleBlock: {
    marginBottom: 2,
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
    width: 74,
    color: '#4b5563',
    marginRight: 6,
  },
  infoValue: {
    flex: 1,
    fontWeight: 700,
  },
  sectionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionColumn: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 10,
    minHeight: 220,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: {
    flex: 1,
  },
  rowAmount: {
    width: 92,
    textAlign: 'right',
    fontWeight: 700,
  },
  emptyState: {
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  informationalSection: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 10,
    marginBottom: 12,
  },
  informationalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  informationalItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  informationalLabel: {
    flex: 1,
  },
  informationalAmount: {
    width: 88,
    textAlign: 'right',
    fontWeight: 700,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: '#111827',
    padding: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontWeight: 700,
  },
  summaryAmount: {
    fontWeight: 700,
  },
  thpRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  thpLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  thpAmount: {
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

function renderLineItems(items: SlipGajiLineItem[]) {
  if (items.length === 0) {
    return <Text style={styles.emptyState}>Tidak ada komponen pada periode ini.</Text>;
  }

  return items.map((item) => (
    <View key={`${item.category}-${item.label}`} style={styles.row}>
      <Text style={styles.rowLabel}>{item.label}</Text>
      <Text style={styles.rowAmount}>{formatCurrency(item.amount)}</Text>
    </View>
  ));
}

function renderInformationalItems(items: SlipGajiLineItem[]) {
  if (items.length === 0) {
    return <Text style={styles.emptyState}>Tidak ada komponen informasional.</Text>;
  }

  return (
    <View style={styles.informationalGrid}>
      {items.map((item) => (
        <View key={`${item.category}-${item.label}`} style={styles.informationalItem}>
          <Text style={styles.informationalLabel}>{item.label}</Text>
          <Text style={styles.informationalAmount}>{formatCurrency(item.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

type SlipGajiDocumentProps = {
  payload: SlipGajiPayload;
};

export function SlipGajiDocument({ payload }: SlipGajiDocumentProps) {
  return (
    <Document title={`Slip Gaji ${payload.employee.nama}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Slip Gaji</Text>
            <Text style={styles.subtitle}>{payload.period.label}</Text>
          </View>
          <View>
            <Text style={styles.companyName}>{payload.companyName}</Text>
            <Text style={styles.subtitle}>
              Metode Pajak: {payload.employee.metodePajak.replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.infoGrid}>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Nama</Text>
              <Text style={styles.infoValue}>{payload.employee.nama}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>NIP</Text>
              <Text style={styles.infoValue}>{payload.employee.employeeId}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Jabatan</Text>
              <Text style={styles.infoValue}>{payload.employee.jabatan}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Cabang</Text>
              <Text style={styles.infoValue}>{payload.employee.cabang}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Divisi</Text>
              <Text style={styles.infoValue}>{payload.employee.divisi}</Text>
            </View>
            <View style={styles.infoCell}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {payload.employee.residentStatus} / {payload.employee.statusIdentitas}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionGrid}>
          <View style={styles.sectionColumn}>
            <Text style={styles.sectionTitle}>Penerimaan Tunai</Text>
            {renderLineItems(payload.penerimaan)}
          </View>
          <View style={styles.sectionColumn}>
            <Text style={styles.sectionTitle}>Potongan Tunai</Text>
            {renderLineItems(payload.potongan)}
          </View>
        </View>

        <View style={styles.informationalSection}>
          <Text style={styles.sectionTitle}>Komponen Ditanggung Perusahaan / Informasional</Text>
          {renderInformationalItems(payload.informational)}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Penerimaan Tunai</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(payload.totals.totalPenerimaan)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Potongan Tunai</Text>
            <Text style={styles.summaryAmount}>
              {formatCurrency(payload.totals.totalPotongan)}
            </Text>
          </View>
          <View style={styles.thpRow}>
            <Text style={styles.thpLabel}>Take Home Pay</Text>
            <Text style={styles.thpAmount}>{formatCurrency(payload.totals.thp)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Dibuat dari payroll bulanan yang aktif pada aplikasi.</Text>
          <Text>Diterima oleh: ____________________</Text>
        </View>
      </Page>
    </Document>
  );
}

export default SlipGajiDocument;
