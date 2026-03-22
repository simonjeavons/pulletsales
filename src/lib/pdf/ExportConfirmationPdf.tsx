import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 8, color: "#1a1a1a", orientation: "landscape" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 3, marginBottom: 4, fontWeight: "bold", fontSize: 7 },
  tableRow: { flexDirection: "row", marginBottom: 2, fontSize: 7 },
  colInv: { width: "7%" },
  colTrading: { width: "5%" },
  colType: { width: "4%" },
  colAccount: { width: "7%" },
  colNominal: { width: "7%" },
  colDept: { width: "5%" },
  colDate: { width: "10%" },
  colRef: { width: "7%" },
  colDetails: { width: "20%" },
  colNet: { width: "12%", textAlign: "right" },
  colTaxCode: { width: "6%", textAlign: "center" },
  colTaxAmt: { width: "10%", textAlign: "right" },
  pageNum: { position: "absolute", bottom: 20, right: 30, fontSize: 7, color: "#888" },
});

interface ExportRow {
  invoiceNumber: string;
  tradingCo: string;
  type: string;
  account: string;
  nominal: string;
  dept: string;
  date: string;
  ref: string;
  details: string;
  net: string;
  taxCode: string;
  taxAmount: string;
}

export function ExportConfirmationPdf({ rows }: { rows: ExportRow[] }) {
  // Split into pages of ~25 rows
  const perPage = 25;
  const pages: ExportRow[][] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }

  return (
    <Document>
      {pages.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="A4" orientation="landscape" style={s.page}>
          <Text style={s.title}>TAS Pending - Export File</Text>

          <View style={s.tableHeader}>
            <Text style={s.colInv}>Invoice{"\n"}No.</Text>
            <Text style={s.colTrading}>Trading{"\n"}Co.</Text>
            <Text style={s.colType}>Type</Text>
            <Text style={s.colAccount}>Account</Text>
            <Text style={s.colNominal}>Nominal</Text>
            <Text style={s.colDept}>Dept</Text>
            <Text style={s.colDate}>Date</Text>
            <Text style={s.colRef}>Ref</Text>
            <Text style={s.colDetails}>Details</Text>
            <Text style={s.colNet}>Net</Text>
            <Text style={s.colTaxCode}>Tax{"\n"}Code</Text>
            <Text style={s.colTaxAmt}>Tax{"\n"}Amount</Text>
          </View>

          {pageRows.map((row, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.colInv}>{row.invoiceNumber}</Text>
              <Text style={s.colTrading}>{row.tradingCo}</Text>
              <Text style={s.colType}>{row.type}</Text>
              <Text style={s.colAccount}>{row.account}</Text>
              <Text style={s.colNominal}>{row.nominal}</Text>
              <Text style={s.colDept}>{row.dept}</Text>
              <Text style={s.colDate}>{row.date}</Text>
              <Text style={s.colRef}>{row.ref}</Text>
              <Text style={s.colDetails}>{row.details}</Text>
              <Text style={s.colNet}>{row.net}</Text>
              <Text style={s.colTaxCode}>{row.taxCode}</Text>
              <Text style={s.colTaxAmt}>{row.taxAmount}</Text>
            </View>
          ))}

          <Text style={s.pageNum}>
            {pageIdx + 1} / {pages.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
