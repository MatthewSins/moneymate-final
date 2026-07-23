export interface Invoice {
  invoice_type: 'sales' | 'purchase';
  invoice_number: string;
  date: string;
  vendor_name: string;
  vendor_gstin: string;
  customer_gstin?: string;
  total_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
}

export interface InvoiceValidation {
  valid: boolean;
  itcEligible: boolean;
  errors: string[];
  warnings: string[];
  complianceStatus: 'compliant' | 'warning' | 'non_compliant';
}

export function validateInvoice(invoice: Invoice): InvoiceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let itcEligible = true;

  // 1. GSTIN Format Validation
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  
  if (!invoice.vendor_gstin) {
    errors.push('Missing vendor GSTIN. Cannot claim ITC without it.');
    itcEligible = false;
  } else if (!gstinRegex.test(invoice.vendor_gstin)) {
    errors.push(`Invalid vendor GSTIN format: ${invoice.vendor_gstin}`);
    itcEligible = false;
  }

  // 2. Invoice Number Validation
  if (!invoice.invoice_number || invoice.invoice_number.trim() === '') {
    errors.push('Missing invoice number');
  }

  // 3. Date Validation
  if (!invoice.date || new Date(invoice.date) > new Date()) {
    errors.push('Invoice date is missing or in the future');
  }

  // 4. Amount Validation
  if (invoice.total_amount <= 0) {
    errors.push('Invoice amount must be greater than 0');
  }

  // 5. Tax Breakdown Validation
  const expectedTax = invoice.total_amount * 0.18; // Assuming 18%
  const actualTax = (invoice.total_cgst || 0) + (invoice.total_sgst || 0) + (invoice.total_igst || 0);
  
  if (Math.abs(expectedTax - actualTax) > 100) {
    warnings.push(
      `Tax calculation seems off. Expected ₹\${expectedTax.toFixed(0)}, ` +
      `got ₹\${actualTax.toFixed(0)}. Please verify.`
    );
  }

  // 6. SGST + CGST = IGST Rule (for intra-state)
  if ((invoice.total_sgst || 0) + (invoice.total_cgst || 0) !== (invoice.total_igst || 0)) {
    if ((invoice.total_igst || 0) === 0 && (invoice.total_sgst || 0) === 0 && (invoice.total_cgst || 0) === 0) {
      warnings.push('No GST on this invoice. Verify if this is a 0% rated supply (e.g., books, food).');
    } else if (Math.abs(((invoice.total_sgst || 0) + (invoice.total_cgst || 0)) - (invoice.total_igst || 0)) > 50) {
      warnings.push(
        `Possible inter-state (IGST) transaction detected. ` +
        `IGST should equal SGST + CGST only for intra-state. ` +
        `Confirm: SGST ₹\${invoice.total_sgst || 0} + CGST ₹\${invoice.total_cgst || 0} ≠ IGST ₹\${invoice.total_igst || 0}`
      );
    }
  }

  // 7. ITC Eligibility Summary
  if (!itcEligible) {
    warnings.push(
      `⚠️ Cannot claim Input Tax Credit (ITC) on this invoice. ` +
      `Classify as personal expense or expense without GST credit.`
    );
  } else {
    // Can claim ITC
    const totalITC = (invoice.total_cgst || 0) + (invoice.total_sgst || 0);
    warnings.push(
      `✅ ITC Eligible: Can claim ₹\${totalITC.toFixed(0)} as input tax credit.`
    );
  }

  const complianceStatus = 
    errors.length > 0 ? 'non_compliant' :
    warnings.length > 0 ? 'warning' :
    'compliant';

  return {
    valid: errors.length === 0,
    itcEligible,
    errors,
    warnings,
    complianceStatus
  };
}
