import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  headerLeft: { width: "45%" },
  headerRight: { width: "50%", alignItems: "flex-end" },
  companyName: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  companyNameLine2: { fontSize: 22, fontWeight: "bold" },
  regInfo: { fontSize: 8, color: "#555", marginTop: 4 },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "right", marginBottom: 20 },
  addressBlock: { marginBottom: 6 },
  toLabel: { fontWeight: "bold", marginBottom: 2 },
  bold: { fontWeight: "bold" },
  dateRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  orderNoRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  bodyText: { marginBottom: 10, lineHeight: 1.5 },
  warningText: { marginBottom: 16, lineHeight: 1.5 },
  table: { marginBottom: 20 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000", paddingBottom: 4, marginBottom: 4, fontWeight: "bold", fontSize: 9 },
  tableRow: { flexDirection: "row", marginBottom: 2, fontSize: 9 },
  colItem: { width: "5%" },
  colDate: { width: "13%" },
  colNumber: { width: "10%" },
  colDetails: { width: "32%" },
  colAge: { width: "8%" },
  colPrice: { width: "15%", textAlign: "right" },
  colFood: { width: "12%", textAlign: "right" },
  deliveryBlock: { marginLeft: 20, marginTop: 4, marginBottom: 8 },
  extrasBlock: { marginLeft: "28%", marginTop: 2 },
  separator: { borderBottomWidth: 1, borderBottomColor: "#3b82f6", marginVertical: 16 },
  footer: { position: "absolute", bottom: 40, left: 40, right: 40 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigLine: { borderTopWidth: 1, borderTopColor: "#000", borderStyle: "dotted", width: 200, marginTop: 30 },
  termsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, borderTopWidth: 1, borderTopColor: "#000", paddingTop: 8 },
  interestWarning: { color: "#dc2626", fontSize: 8, fontWeight: "bold" },
});

interface OrderConfirmationData {
  isAmended: boolean;
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
  lines: Array<{
    itemNumber: number;
    deliveryDate: string;
    quantity: number;
    breed: string;
    age: number | null;
    price: number;
    foodClause: number;
    deliveryAddress?: {
      label: string;
      company_name?: string;
      address_line_1?: string;
      address_line_2?: string;
      town_city?: string;
      post_code?: string;
    };
    extras: string[];
  }>;
}

export function OrderConfirmationPdf({ data }: { data: OrderConfirmationData }) {
  const displayOrderNo = `${data.orderNumber}/${data.repName}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Title */}
        <Text style={s.title}>
          {data.isAmended ? "AMENDED ORDER CONFIRMATION" : "ORDER CONFIRMATION"}
        </Text>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
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
          <View style={s.headerRight}>
            <Text style={s.companyName}>Country Fresh Pullets</Text>
            <Text style={s.companyNameLine2}>Limited</Text>
            <Text style={s.regInfo}>Registered Office    MORTON    OSWESTRY    SALOP SY10 8BH</Text>
            <Text style={s.regInfo}>Registered No         826601 England</Text>
          </View>
        </View>

        {/* To / Date / Order No */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
          <View style={{ width: "55%" }}>
            <Text style={{ fontWeight: "bold", marginBottom: 4 }}>To:  {data.customer.company_name}</Text>
            {data.customer.address_line_1 && <Text>       {data.customer.address_line_1}</Text>}
            {data.customer.address_line_2 && <Text>       {data.customer.address_line_2}</Text>}
            {data.customer.town_city && <Text>       {data.customer.town_city}</Text>}
            {data.customer.post_code && <Text>       {data.customer.post_code}</Text>}
          </View>
          <View style={{ width: "40%", alignItems: "flex-end" }}>
            <Text style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: "bold" }}>Date:  </Text>{data.date}
            </Text>
            <Text>
              <Text style={{ fontWeight: "bold" }}>Order No:  </Text>{displayOrderNo}
            </Text>
          </View>
        </View>

        {/* Body text */}
        <Text style={s.bodyText}>Dear Sirs,</Text>
        <Text style={s.bodyText}>
          We thank you for your order and have pleasure in confirming we have booked the following. The exact delivery date will be advised approximately 14 days before delivery.
        </Text>
        <Text style={s.warningText}>
          If your farm capacity is in excess of 40,000 birds you should ensure you have the correct IPPC permit.
        </Text>

        {/* Lines table */}
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={s.colItem}>Item</Text>
            <Text style={s.colDate}>Delivery{"\n"}Date</Text>
            <Text style={s.colNumber}>Number</Text>
            <Text style={s.colDetails}>Details</Text>
            <Text style={s.colAge}>Age</Text>
            <Text style={s.colPrice}>Price Per{"\n"}Pullet</Text>
            <Text style={s.colFood}>Food{"\n"}Clause</Text>
          </View>

          {data.lines.map((line) => (
            <View key={line.itemNumber}>
              <View style={s.tableRow}>
                <Text style={s.colItem}>{line.itemNumber}</Text>
                <Text style={s.colDate}>{line.deliveryDate}</Text>
                <Text style={s.colNumber}>{line.quantity.toLocaleString()}</Text>
                <Text style={s.colDetails}>{line.breed}</Text>
                <Text style={s.colAge}>{line.age ?? ""}</Text>
                <Text style={s.colPrice}>{line.price.toFixed(4)}</Text>
                <Text style={s.colFood}>{line.foodClause}</Text>
              </View>

              {/* Delivery address under line */}
              {line.deliveryAddress && (
                <View style={{ flexDirection: "row", marginTop: 2 }}>
                  <View style={{ width: "18%" }}>
                    <Text style={{ fontSize: 9 }}>To: {line.deliveryAddress.label}</Text>
                  </View>
                  <View style={{ width: "50%" }}>
                    {line.extras.length > 0 && line.extras.map((ex, i) => (
                      <Text key={i} style={{ fontSize: 9 }}>{ex}</Text>
                    ))}
                  </View>
                </View>
              )}

              {line.deliveryAddress && (
                <View style={{ marginLeft: 20, marginTop: 2 }}>
                  {line.deliveryAddress.company_name && <Text style={{ fontSize: 9 }}>{line.deliveryAddress.company_name}</Text>}
                  {line.deliveryAddress.address_line_1 && <Text style={{ fontSize: 9 }}>{line.deliveryAddress.address_line_1}</Text>}
                  {line.deliveryAddress.address_line_2 && <Text style={{ fontSize: 9 }}>{line.deliveryAddress.address_line_2}</Text>}
                  {line.deliveryAddress.town_city && <Text style={{ fontSize: 9 }}>{line.deliveryAddress.town_city}</Text>}
                  {line.deliveryAddress.post_code && <Text style={{ fontSize: 9 }}>{line.deliveryAddress.post_code}</Text>}
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={s.separator} />

        {/* Signature area */}
        <View style={s.sigRow}>
          <View>
            <View style={s.sigLine} />
            <Text style={{ marginTop: 4, fontWeight: "bold" }}>For Country Fresh Pullets Limited</Text>
            <Text style={{ marginTop: 20 }}>Customer's signature .......................................</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 9, fontStyle: "italic", textAlign: "center" }}>
              Subject to our Terms and Conditions of{"\n"}Sales as set out overleaf
            </Text>
          </View>
        </View>

        {/* Terms footer */}
        <View style={s.termsRow}>
          <Text style={{ fontWeight: "bold" }}>Terms: Within 7 days</Text>
          <Text style={s.interestWarning}>INTEREST WILL BE CHARGED ON OVERDUE ACCOUNTS</Text>
        </View>
      </Page>
    </Document>
  );
}
