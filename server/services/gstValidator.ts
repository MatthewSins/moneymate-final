export interface GSTValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  gstData: any;
}

export interface GST3BRequest {
  gstin: string;
  fy: string;
  quarter: string;
  businessType: string;
  sales: number;
  taxableSales: number;
  purchases: number;
  itcPurchases: number;
  b2b: number;
  b2c: number;
  exportSales: number;
}

export function validateGST3BData(data: GST3BRequest): GSTValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. GSTIN Format Validation
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!data.gstin || !gstinRegex.test(data.gstin)) {
    errors.push(
      `Invalid GSTIN format: ${data.gstin}. Expected format: 27AABCT1234H1Z0`
    );
  }

  // 2. Sales Validation
  if (data.taxableSales > data.sales) {
    errors.push(
      `Taxable sales (₹${data.taxableSales}) cannot exceed total sales (₹${data.sales})`
    );
  }

  // 3. ITC Validation - CRITICAL
  if (data.itcPurchases > data.purchases) {
    errors.push(
      `ITC eligible purchases (₹${data.itcPurchases}) cannot exceed total purchases (₹${data.purchases})`
    );
  }

  // 4. B2B + B2C Sanity Check
  if (data.b2b + data.b2c > data.taxableSales) {
    warnings.push(
      `B2B (₹${data.b2b}) + B2C (₹${data.b2c}) exceeds taxable sales (₹${data.taxableSales}). ` +
      `This is unusual. Please verify.`
    );
  }

  // 5. Export Sales (0% GST) - No GST liability
  if (data.exportSales > 0) {
    warnings.push(
      `Export sales of ₹${data.exportSales} are at 0% GST. ` +
      `Ensure you have proper export documentation (shipping bills, etc.).`
    );
  }

  // 6. Reverse Charge for Services >₹5000
  // This is a placeholder - you'd need transaction data to fully implement
  warnings.push(
    `Remember: B2B services >₹5,000 may have reverse charge. ` +
    `ITC is NOT available on reverse charge items. Please review manually.`
  );

  // 7. GST Calculation Estimates (18% default for simplicity)
  // In reality, different HSN codes have different rates (5%, 12%, 18%, 28%)
  const estimatedSGST = (data.taxableSales * 0.09); // 9% SGST for 18% total
  const estimatedCGST = (data.taxableSales * 0.09); // 9% CGST for 18% total
  const estimatedIGST = 0; // Assuming intra-state (SGST + CGST)

  // ITC eligibility - Conservative approach
  let itcSGST = estimatedSGST * (data.itcPurchases / (data.purchases || 1));
  let itcCGST = estimatedCGST * (data.itcPurchases / (data.purchases || 1));
  let itcIGST = estimatedIGST;

  const netSGST = Math.max(0, estimatedSGST - itcSGST);
  const netCGST = Math.max(0, estimatedCGST - itcCGST);
  const netIGST = Math.max(0, estimatedIGST - itcIGST);

  const gstData = {
    gst_liability: {
      sgst: Math.round(estimatedSGST),
      cgst: Math.round(estimatedCGST),
      igst: Math.round(estimatedIGST),
      total_gst: Math.round(estimatedSGST + estimatedCGST + estimatedIGST)
    },
    input_tax_credit: {
      sgst: Math.round(itcSGST),
      cgst: Math.round(itcCGST),
      igst: Math.round(itcIGST),
      total_itc: Math.round(itcSGST + itcCGST + itcIGST)
    },
    net_gst_payable: Math.round(netSGST + netCGST + netIGST),
    compliance_warnings: warnings
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    gstData
  };
}

export function generateGST3BXml(data: GST3BRequest, validation: GSTValidationResult) {
  if (!validation.valid) {
    throw new Error(`Cannot generate GST-3B: ${validation.errors.join('; ')}`);
  }

  const { gst_liability, input_tax_credit, net_gst_payable } = validation.gstData;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GSTR3B>
  <FY>${data.fy}</FY>
  <QUARTER>${data.quarter}</QUARTER>
  <GSTIN>${data.gstin}</GSTIN>
  <OUTWARD>
    <B2B>
      <SGST>${Math.round((data.b2b * 0.09))}</SGST>
      <CGST>${Math.round((data.b2b * 0.09))}</CGST>
      <IGST>0</IGST>
    </B2B>
    <B2C>
      <SGST>${Math.round((data.b2c * 0.09))}</SGST>
      <CGST>${Math.round((data.b2c * 0.09))}</CGST>
      <IGST>0</IGST>
    </B2C>
    <EXPORT>
      <AMOUNT>${data.exportSales}</AMOUNT>
      <TAX_RATE>0%</TAX_RATE>
    </EXPORT>
  </OUTWARD>
  <INWARD>
    <ITC>
      <SGST>${input_tax_credit.sgst}</SGST>
      <CGST>${input_tax_credit.cgst}</CGST>
      <IGST>${input_tax_credit.igst}</IGST>
    </ITC>
  </INWARD>
  <NET_PAYABLE>
    <SGST>${gst_liability.sgst - input_tax_credit.sgst}</SGST>
    <CGST>${gst_liability.cgst - input_tax_credit.cgst}</CGST>
    <IGST>${gst_liability.igst - input_tax_credit.igst}</IGST>
    <TOTAL>${net_gst_payable}</TOTAL>
  </NET_PAYABLE>
</GSTR3B>`;

  return xml;
}
