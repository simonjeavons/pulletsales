import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "right", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  companyName: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  companyNameLine2: { fontSize: 22, fontWeight: "bold" },
  regInfo: { fontSize: 8, color: "#555", marginTop: 3 },
  bold: { fontWeight: "bold" },
  row: { flexDirection: "row" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 4, marginBottom: 6, fontWeight: "bold", fontSize: 9 },
  tableRow: { flexDirection: "row", marginBottom: 2, fontSize: 9 },
  colDate: { width: "11%" },
  colDesp: { width: "9%" },
  colNum: { width: "9%" },
  colDetails: { width: "35%" },
  colPrice: { width: "12%", textAlign: "right" },
  colTax: { width: "8%", textAlign: "right" },
  colAmount: { width: "16%", textAlign: "right" },
  separator: { borderBottomWidth: 1, borderBottomColor: "#555", marginVertical: 12 },
  totalsBlock: { alignItems: "flex-end", marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  totalLabel: { width: 120, textAlign: "right", marginRight: 12, fontSize: 10 },
  totalValue: { width: 80, textAlign: "right", fontSize: 10 },
  footer: { position: "absolute", bottom: 30, left: 40, fontSize: 8, color: "#888" },
});

interface InvoiceLine {
  deliveryDate: string;
  despatchNumber: string;
  quantity: number;
  details: string[];
  price: number;
  taxRate: number;
  amount: number;
}

interface InvoicePdfData {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  repName: string;
  vatRegistration: string;
  customer: {
    company_name: string;
    address_line_1?: string;
    address_line_2?: string;
    town_city?: string;
    county?: string;
    post_code?: string;
  };
  lines: InvoiceLine[];
  foodClauseAdjustment: number;
  foodClauseTaxRate: number;
  totalVat: number;
  strictlyNet: number;
  invoiceTotal: number;
  paymentDueDate: string;
  paymentTermsDays: number;
  bankName: string;
  bankSortCode: string;
  bankAccountNo: string;
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const displayOrderNo = `${data.orderNumber}/${data.repName}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>INVOICE {data.invoiceNumber}</Text>

        {/* Header */}
        <View style={s.header}>
          <View style={{ width: "45%" }}>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Morton</Text>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Oswestry</Text>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Shropshire SY10 8BH</Text>
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 9 }}>
                <Text style={s.bold}>Telephone:</Text>  01691 831020
              </Text>
              <Text style={{ fontSize: 9 }}>
                <Text style={s.bold}>Fax:</Text>            01691 831438
              </Text>
            </View>
          </View>
          <View style={{ width: "50%", alignItems: "flex-end" }}>
            <Text style={s.companyName}>Country Fresh</Text>
            <Text style={s.companyNameLine2}>Pullets Limited</Text>
            <Text style={s.regInfo}>Registered Office    MORTON    OSWESTRY    SALOP SY10 8BH</Text>
            <Text style={s.regInfo}>Registered No         826601 England</Text>
            <Text style={s.regInfo}>VAT Registration      {data.vatRegistration}</Text>
          </View>
        </View>

        {/* To / Invoice Date */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <View style={{ width: "55%" }}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>To:  {data.customer.company_name}</Text>
            {data.customer.address_line_1 && <Text style={s.bold}>       {data.customer.address_line_1}</Text>}
            {data.customer.address_line_2 && <Text style={s.bold}>       {data.customer.address_line_2}</Text>}
            {data.customer.town_city && <Text style={s.bold}>       {data.customer.town_city},</Text>}
            {data.customer.county && <Text style={s.bold}>       {data.customer.county},</Text>}
            {data.customer.post_code && <Text style={s.bold}>       {data.customer.post_code}</Text>}
          </View>
          <View style={{ width: "40%", alignItems: "flex-end" }}>
            <Text style={{ marginBottom: 10 }}>
              <Text style={s.bold}>Invoice Date:    </Text>{data.invoiceDate}
            </Text>
          </View>
        </View>

        {/* Order No */}
        <View style={{ alignItems: "flex-end", marginBottom: 16 }}>
          <Text>
            <Text style={s.bold}>Order No:    </Text>{displayOrderNo}
          </Text>
        </View>

        {/* Lines table */}
        <View style={s.tableHeader}>
          <Text style={s.colDate}>Delivery{"\n"}Date</Text>
          <Text style={s.colDesp}>Despatch{"\n"}No.</Text>
          <Text style={s.colNum}>Number</Text>
          <Text style={s.colDetails}>Details</Text>
          <Text style={s.colPrice}>Price</Text>
          <Text style={s.colTax}>Tax{"\n"}Rate</Text>
          <Text style={s.colAmount}>£</Text>
        </View>

        {data.lines.map((line, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <View style={s.tableRow}>
              <Text style={s.colDate}>{line.deliveryDate}</Text>
              <Text style={s.colDesp}>{line.despatchNumber}</Text>
              <Text style={s.colNum}>{line.quantity.toLocaleString()}</Text>
              <View style={s.colDetails}>
                {line.details.map((d, j) => (
                  <Text key={j} style={{ fontSize: 9 }}>{d}</Text>
                ))}
              </View>
              <Text style={s.colPrice}>{line.price.toFixed(4)}</Text>
              <Text style={s.colTax}>{line.taxRate.toFixed(2)}</Text>
              <Text style={s.colAmount}>{line.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>
        ))}

        {/* Food Clause Adjustment */}
        {data.foodClauseAdjustment !== 0 && (
          <View style={s.tableRow}>
            <Text style={s.colDate}></Text>
            <Text style={s.colDesp}></Text>
            <Text style={s.colNum}></Text>
            <Text style={s.colDetails}>Food Clause Adjustment</Text>
            <Text style={s.colPrice}>{data.foodClauseAdjustment.toFixed(4)}</Text>
            <Text style={s.colTax}>{data.foodClauseTaxRate.toFixed(2)}</Text>
            <Text style={s.colAmount}>
              {(data.foodClauseAdjustment < 0 ? "-" : "")}
              {Math.abs(data.lines.reduce((s, l) => s + l.quantity, 0) * data.foodClauseAdjustment).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        <View style={s.separator} />

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, s.bold]}>Total VAT</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Strictly Net</Text>
            <Text style={s.totalValue}>{data.totalVat.toFixed(2)}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: "#000", marginVertical: 4, width: 200 }} />
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, s.bold]}>Invoice Total</Text>
            <Text style={[s.totalValue, s.bold]}>
              £{data.invoiceTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Payment Due */}
        <View style={{ textAlign: "center", marginTop: 20, marginBottom: 16 }}>
          <Text style={s.bold}>Payment Due By: {data.paymentDueDate}</Text>
        </View>

        {/* Terms */}
        <Text style={s.bold}>Terms: Within {data.paymentTermsDays} days</Text>
        <Text style={{ fontSize: 9, marginTop: 4 }}>
          A 10pence/pullet surcharge applies if terms are exceeded.
        </Text>

        {/* Bank Details */}
        <View style={{ marginTop: 40 }}>
          <Text style={{ textDecoration: "underline", fontWeight: "bold", marginBottom: 4 }}>Bank Details</Text>
          <Text>{data.bankName}</Text>
          <Text>Sort Code: {data.bankSortCode}</Text>
          <Text>Account No: {data.bankAccountNo}</Text>
        </View>

        <Text style={s.footer}>Customer Copy</Text>
      </Page>
    </Document>
  );
}
