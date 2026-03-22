import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "right", marginBottom: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyName: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  companyNameLine2: { fontSize: 22, fontWeight: "bold" },
  regInfo: { fontSize: 8, color: "#555", marginTop: 4 },
  bold: { fontWeight: "bold" },
  bodyText: { marginBottom: 10, lineHeight: 1.5 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 4, marginBottom: 4, fontWeight: "bold", fontSize: 9 },
  tableRow: { flexDirection: "row", marginBottom: 2, fontSize: 9 },
  colDate: { width: "15%" },
  colNumber: { width: "18%" },
  colTransporter: { width: "17%" },
  colTime: { width: "18%", textAlign: "center" },
  colDelivery: { width: "32%" },
  vaccBlock: { marginTop: 20, marginBottom: 16 },
  note: { fontSize: 8, marginTop: 8, color: "#555" },
  sigLine: { borderTopWidth: 1, borderTopColor: "#000", borderStyle: "dotted", width: 200, marginTop: 60 },
  footer: { position: "absolute", bottom: 30, left: 40, fontSize: 8, color: "#888" },
});

interface DeliveryAdviceData {
  date: string;
  orderNumber: string;
  repName: string;
  customer: {
    company_name: string;
    address_line_1?: string;
    address_line_2?: string;
    town_city?: string;
    post_code?: string;
  };
  totalQuantity: number;
  breed: string;
  age: number | null;
  weekCommencing: string;
  lines: Array<{
    deliveryDate: string;
    quantity: number;
    breed: string;
    transporter: string;
    unloadingTime: string;
    deliveryTo: {
      name: string;
      address_line_1?: string;
      address_line_2?: string;
      town_city?: string;
      post_code?: string;
    };
  }>;
  extras: string[];
}

export function DeliveryAdvicePdf({ data }: { data: DeliveryAdviceData }) {
  const displayOrderNo = `${data.orderNumber}/${data.repName}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>DELIVERY ADVICE</Text>

        {/* Header */}
        <View style={s.header}>
          <View style={{ width: "45%" }}>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Morton</Text>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Oswestry</Text>
            <Text style={{ fontWeight: "bold", fontSize: 11 }}>Shropshire SY10 8BH</Text>
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 9 }}>
                <Text style={{ fontWeight: "bold" }}>Telephone:</Text>  01691 831020
              </Text>
              <Text style={{ fontSize: 9 }}>
                <Text style={{ fontWeight: "bold" }}>Fax:</Text>            01691 831438
              </Text>
            </View>
          </View>
          <View style={{ width: "50%", alignItems: "flex-end" }}>
            <Text style={s.companyName}>Country Fresh</Text>
            <Text style={s.companyNameLine2}>Pullets Limited</Text>
            <Text style={s.regInfo}>Registered Office    MORTON    OSWESTRY    SALOP SY10 8BH</Text>
            <Text style={s.regInfo}>Registered No         826601 England</Text>
          </View>
        </View>

        {/* To / Date / Order No */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ width: "55%" }}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>To:  {data.customer.company_name}</Text>
            {data.customer.address_line_1 && <Text>       {data.customer.address_line_1}</Text>}
            {data.customer.address_line_2 && <Text>       {data.customer.address_line_2}</Text>}
            {data.customer.town_city && <Text>       {data.customer.town_city}</Text>}
            {data.customer.post_code && <Text>       {data.customer.post_code}</Text>}
          </View>
          <View style={{ width: "40%", alignItems: "flex-end" }}>
            <Text style={{ marginBottom: 10 }}>
              <Text style={s.bold}>Date:  </Text>{data.date}
            </Text>
            <Text>
              <Text style={s.bold}>Order No:  </Text>{displayOrderNo}
            </Text>
          </View>
        </View>

        {/* Reference text */}
        <Text style={s.bodyText}>Dear Sir/Madam</Text>
        <Text style={s.bodyText}>
          With further reference to your order for {data.totalQuantity.toLocaleString()} pullets to be supplied during the week commencing {data.weekCommencing} at {data.age ?? "—"} weeks old.
        </Text>
        <Text style={s.bodyText}>
          We have pleasure in advising you that delivery has been arranged as follows:
        </Text>

        {/* Delivery table */}
        <View style={{ marginBottom: 16 }}>
          <View style={s.tableHeader}>
            <Text style={s.colDate}>Date</Text>
            <Text style={s.colNumber}>Number</Text>
            <Text style={s.colTransporter}>Transporter</Text>
            <Text style={s.colTime}>Proposed{"\n"}Unloading Time</Text>
            <Text style={s.colDelivery}>Delivery To</Text>
          </View>

          {data.lines.map((line, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.colDate}>{line.deliveryDate}</Text>
              <Text style={s.colNumber}>{line.quantity.toLocaleString()} {line.breed}</Text>
              <Text style={s.colTransporter}>{line.transporter}</Text>
              <Text style={s.colTime}>{line.unloadingTime}</Text>
              <View style={s.colDelivery}>
                <Text style={s.bold}>{line.deliveryTo.name}</Text>
                {line.deliveryTo.address_line_1 && <Text>{line.deliveryTo.address_line_1}</Text>}
                {line.deliveryTo.address_line_2 && <Text>{line.deliveryTo.address_line_2}</Text>}
                {line.deliveryTo.town_city && <Text>{line.deliveryTo.town_city}</Text>}
                {line.deliveryTo.post_code && <Text>{line.deliveryTo.post_code}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* Vaccination info */}
        <View style={s.vaccBlock}>
          <Text style={{ fontSize: 9 }}>
            <Text style={s.bold}>The birds will have been vaccinated or</Text>
          </Text>
          <Text style={{ fontSize: 9 }}>
            <Text style={{ width: 180 }}>                         treated as follows:</Text>
            {data.extras.length > 0 ? data.extras.map((ex, i) => (
              <Text key={i}>{i === 0 ? "  " : "\n                                                      "}{ex}</Text>
            )) : "  N/A"}
          </Text>
        </View>

        {/* Notes */}
        <Text style={s.note}>
          n.b. Weight loss in transit is normally 10% e.g. a 16w/o target 1350g - 135g = 1215g
        </Text>
        <Text style={s.note}>
          Please note the vehicle may arrive prior to the proposed unloading time and an estimate of this time can be advised if you wish to unload earlier.
        </Text>

        {/* Signature */}
        <View style={{ marginTop: 40, alignItems: "flex-end" }}>
          <View style={s.sigLine} />
          <Text style={{ marginTop: 4, fontWeight: "bold" }}>For Country Fresh Pullets Limited</Text>
        </View>

        <Text style={s.footer}>Office Copy</Text>
      </Page>
    </Document>
  );
}
