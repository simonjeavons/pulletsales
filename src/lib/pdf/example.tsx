/**
 * PDF generation infrastructure using React PDF.
 * Scaffolded for Phase 2 order confirmations.
 */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1e293b",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1e40af",
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase" as const,
    marginBottom: 4,
  },
  value: {
    fontSize: 11,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#94a3b8",
  },
});

/**
 * Example PDF document — will be extended for order confirmations in Phase 2.
 */
export function ExampleOrderPdf({ title }: { title: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Lloyds Pullet Sales</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Document</Text>
          <Text style={styles.value}>{title}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Generated</Text>
          <Text style={styles.value}>{new Date().toLocaleDateString()}</Text>
        </View>
        <Text style={styles.footer}>
          Lloyds Pullet Sales Order System — Confidential
        </Text>
      </Page>
    </Document>
  );
}
