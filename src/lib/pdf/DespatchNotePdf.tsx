import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 12, fontWeight: "bold", textAlign: "right", marginBottom: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  companyName: { fontSize: 20, fontWeight: "bold", marginBottom: 2 },
  companyNameLine2: { fontSize: 20, fontWeight: "bold" },
  regInfo: { fontSize: 8, color: "#555", marginTop: 4 },
  bold: { fontWeight: "bold" },
  fieldRow: { flexDirection: "row", marginBottom: 4 },
  fieldLabel: { width: 130, fontWeight: "bold", fontSize: 10 },
  fieldValue: { fontSize: 10 },
  section: { marginBottom: 16 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#000", borderStyle: "dotted", width: 220, marginTop: 16 },
  note: { fontSize: 8, color: "#555", marginTop: 6, lineHeight: 1.4 },
  copyLabel: { position: "absolute", bottom: 30, left: 40, fontSize: 8, color: "#888" },
  remarksBox: { borderTopWidth: 1, borderTopColor: "#000", marginTop: 16, paddingTop: 8 },
});

interface DespatchNoteData {
  despatchNumber: string;
  orderNumber: string;
  repName: string;
  customer: {
    company_name: string;
    address_line_1?: string;
    address_line_2?: string;
    town_city?: string;
    post_code?: string;
    phone?: string;
  };
  rearerName: string;
  quantity: number;
  totalPullets: number;
  breed: string;
  age: number | null;
  deliveryDate: string;
  unloadingTime: string;
  transporter: string;
  extras: string[];
}

function DespatchNotePage({ data, copyLabel }: { data: DespatchNoteData; copyLabel: string }) {
  const displayOrderNo = `${data.orderNumber}/${data.repName}`;

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.title}>PULLET DESPATCH NOTE {data.despatchNumber}</Text>

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
          <Text style={s.companyName}>Country Fresh Pullets</Text>
          <Text style={s.companyNameLine2}>Limited</Text>
          <Text style={s.regInfo}>Registered Office    MORTON    OSWESTRY    SALOP SY10 8BH</Text>
          <Text style={s.regInfo}>Registered No         826601 England</Text>
        </View>
      </View>

      {/* Order No */}
      <Text style={{ fontWeight: "bold", marginBottom: 10 }}>Order No:  {displayOrderNo}</Text>

      {/* To address */}
      <View style={{ marginBottom: 16 }}>
        <Text style={s.bold}>To:  {data.customer.company_name}</Text>
        {data.customer.address_line_1 && <Text>       {data.customer.address_line_1}</Text>}
        {data.customer.address_line_2 && <Text>       {data.customer.address_line_2}</Text>}
        {data.customer.town_city && <Text>       {data.customer.town_city}</Text>}
        {data.customer.post_code && <Text>       {data.customer.post_code}</Text>}
      </View>

      {data.customer.phone && (
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Tel:</Text>
          <Text style={s.bold}>Mobile: {data.customer.phone}</Text>
        </View>
      )}

      {/* Rearing Farm / Qty */}
      <View style={{ flexDirection: "row", marginTop: 12, marginBottom: 8 }}>
        <View style={{ width: "40%" }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 4 }}>
            <Text style={s.bold}>Rearing Farm</Text>
          </View>
          <Text>{data.rearerName}</Text>
        </View>
        <View style={{ width: "15%" }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 4 }}>
            <Text style={s.bold}>Qty</Text>
          </View>
          <Text>{data.quantity.toLocaleString()}</Text>
        </View>
        <View style={{ width: "45%" }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 2, marginBottom: 4 }}>
            <Text style={s.bold}>Notes</Text>
          </View>
          {data.extras.map((ex, i) => (
            <Text key={i} style={{ fontSize: 9 }}>{ex}</Text>
          ))}
        </View>
      </View>

      <View style={s.fieldRow}>
        <Text style={s.fieldLabel}>No. of Pullets</Text>
        <Text style={s.fieldValue}>{data.totalPullets.toLocaleString()}</Text>
      </View>

      <View style={{ marginTop: 10 }}>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Date Of Delivery</Text>
          <Text style={s.fieldValue}>{data.deliveryDate}</Text>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>For Unloading at</Text>
          <Text style={s.fieldValue}>{data.unloadingTime}</Text>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Pullet Breed</Text>
          <Text style={s.fieldValue}>{data.breed}</Text>
        </View>
        <View style={s.fieldRow}>
          <Text style={s.fieldLabel}>Age</Text>
          <Text style={s.fieldValue}>{data.age ? `${data.age} Wks Old` : "—"}</Text>
        </View>
      </View>

      {/* Notes */}
      <View style={{ flexDirection: "row", marginTop: 16 }}>
        <View style={{ width: "50%" }}>
          <Text style={s.note}>
            n.b. Weight loss in transit is normally 10% e.g. a 16w/o target 1350g - 135g = 1215g
          </Text>
          <Text style={s.note}>
            Please note the vehicle may arrive prior to the proposed unloading time and an estimate of this time can be advised if you wish to unload earlier.
          </Text>
        </View>
        <View style={{ width: "50%", alignItems: "flex-end" }}>
          <Text style={s.bold}>Transporter</Text>
          <Text>{data.transporter}</Text>
        </View>
      </View>

      {/* Consignee section */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ fontWeight: "bold", fontSize: 10, marginBottom: 10 }}>
          TO BE COMPLETED BY CONSIGNEE
        </Text>
        <Text style={{ marginBottom: 16 }}>Received By .......................................................</Text>
        <Text style={{ fontSize: 8, marginLeft: 100 }}>(Signature)</Text>
        <Text style={{ marginTop: 10, marginBottom: 10 }}>Print Name ........................................................</Text>
        <Text>Time Received .................................................</Text>
      </View>

      {/* Remarks */}
      <View style={s.remarksBox}>
        <Text style={{ fontWeight: "bold", textAlign: "center" }}>REMARKS</Text>
      </View>

      <Text style={s.copyLabel}>{copyLabel}</Text>
    </Page>
  );
}

export function DespatchNotePdf({ data }: { data: DespatchNoteData }) {
  return (
    <Document>
      <DespatchNotePage data={data} copyLabel="Customer Copy" />
      <DespatchNotePage data={data} copyLabel="Transporter Copy" />
      <DespatchNotePage data={data} copyLabel="Office Copy" />
    </Document>
  );
}
