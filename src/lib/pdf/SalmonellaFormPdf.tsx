import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center", textDecoration: "underline", marginBottom: 16 },
  subtitle: { fontSize: 11, fontWeight: "bold", marginBottom: 4 },
  copyLabel: { fontSize: 9, textAlign: "right", fontWeight: "bold", marginBottom: 16 },
  bold: { fontWeight: "bold" },
  fieldRow: { flexDirection: "row", marginBottom: 6 },
  fieldLabel: { width: 180, fontSize: 10 },
  fieldValue: { fontSize: 10 },
  sampleTitle: { fontSize: 13, fontWeight: "bold", textAlign: "center", marginTop: 24, marginBottom: 16 },
  sampleRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  labSection: { borderTopWidth: 1, borderTopColor: "#000", marginTop: 20, paddingTop: 10 },
  sigSection: { marginTop: 20 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#000", borderStyle: "dotted", marginTop: 20, width: 280 },
  checkbox: { width: 16, height: 16, borderWidth: 1, borderColor: "#000", marginLeft: 8 },
});

interface SalmonellaFormData {
  despatchNumber: string;
  rearerName: string;
  customerName: string;
  customerPostCode: string;
  transporter: string;
  age: number | null;
  deliveryDate: string;
}

function SalmonellaPage({ data, copyLabel }: { data: SalmonellaFormData; copyLabel: string }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.copyLabel}>{copyLabel}</Text>

      <Text style={s.title}>Pullet Delivery - Salmonella Sample Submission Form</Text>

      <Text style={s.subtitle}>Country Fresh Pullets Limited</Text>
      <Text style={{ marginBottom: 2, fontSize: 9 }}>PULLET DESPATCH Ref {data.despatchNumber}</Text>

      <View style={{ marginTop: 8, marginBottom: 4 }}>
        <Text style={{ fontWeight: "bold" }}>Morton</Text>
        <Text style={{ fontWeight: "bold" }}>Oswestry</Text>
        <Text style={{ fontWeight: "bold" }}>Shropshire SY10 8BH</Text>
      </View>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 9 }}>Telephone:  01691 831020</Text>
        <Text style={{ fontSize: 9 }}>Fax:            01691 831438</Text>
      </View>

      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Rearing Site:</Text>
        <Text style={s.fieldValue}>{data.rearerName}</Text>
      </View>
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Customer Name:</Text>
        <Text style={s.fieldValue}>{data.customerName} - {data.customerPostCode}</Text>
      </View>
      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>Haulier / Driver:</Text>
        <Text style={s.fieldValue}>{data.transporter}</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Total Number of samples submitted accompanying this form:</Text>
          <Text>.............</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Age of birds:</Text>
            <Text style={s.fieldValue}>{data.age ? `${data.age} wks` : "—"}</Text>
          </View>
          <View style={s.fieldRow}>
            <Text style={{ marginRight: 8 }}>Sample Date:</Text>
            <Text>{data.deliveryDate}</Text>
          </View>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Date Submitted:</Text>
          <Text style={s.fieldValue}>{data.deliveryDate}</Text>
        </View>
      </View>

      {/* Type of Sample */}
      <Text style={s.sampleTitle}>Type of Sample (please tick relevant box)</Text>

      <View style={s.sampleRow}>
        <Text>'Gauze' Swabs / Sponge Pad:</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text>Faeces</Text>
          <View style={s.checkbox} />
        </View>
      </View>

      <View style={s.sampleRow}>
        <Text>Type of Salmonella testing method required:</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text>ME01</Text>
          <View style={s.checkbox} />
        </View>
      </View>

      {/* Lab section */}
      <View style={s.labSection}>
        <Text style={{ fontWeight: "bold", textAlign: "center", marginBottom: 8 }}>
          For Laboratory use only.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text>Date Received ..............................</Text>
          <Text>Lab Ref. Number ..............................</Text>
        </View>
      </View>

      {/* Signatures */}
      <View style={s.sigSection}>
        <Text style={{ fontWeight: "bold", fontStyle: "italic", marginBottom: 8 }}>
          To be signed by the Driver:
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 16 }}>
          I have taken the samples in accordance with the agreed company protocol.
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Text>Signed (Driver / Company Representative) ......................................................</Text>
          <Text>Name ..............................</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text>Signed (Customer / Customer Representative)  ............................................</Text>
          <Text>Name ..............................</Text>
        </View>
      </View>
    </Page>
  );
}

export function SalmonellaFormPdf({ data }: { data: SalmonellaFormData }) {
  return (
    <Document>
      <SalmonellaPage data={data} copyLabel="CFP Copy" />
      <SalmonellaPage data={data} copyLabel="Laboratory Copy" />
    </Document>
  );
}
