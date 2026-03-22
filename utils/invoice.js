const PDFDocument = require('pdfkit');

const genInvoice = (sale) => {
  const d = new PDFDocument();
  d.fontSize(18).text(sale.companyName);
  d.fontSize(10).text(`GST: ${sale.gstNumber}`);
  d.moveDown();

  d.text(`Bill No: ${sale.billNo}`);
  d.text(`Customer: ${sale.customerName}`);
  d.text(`Date: ${new Date(sale.createdAt).toDateString()}`);
  d.moveDown();

  d.text(`Brick Type: ${sale.brickType}`);
  d.text(`Quantity: ${sale.quantity}`);
  d.text(`Rate: ₹${sale.rate}`);
  d.text(`Discount: ₹${sale.discount || 0}`);
  d.text(`GST: ${sale.gst ? sale.gstPercent + '%' : 'No'}`);
  d.moveDown();

  d.fontSize(14).text(`Total: ₹${sale.totalAmount}`);

  return d;
};

module.exports = genInvoice;


// const PDFDocument = require('pdfkit');

// const genInvoice = (sale) => {
//   const d = new PDFDocument({ margin: 40, size: 'A4' });

//   // ===== HEADER =====
//   d.fontSize(16).text(sale.companyName, { align: 'center' });
//   d.fontSize(10).text(sale.companyTagline || '', { align: 'center' });
//   d.moveDown(0.5);
//   d.fontSize(9).text(`PAN : ${sale.pan}`, { align: 'left' });
//   d.fontSize(11).text('TAX INVOICE', { align: 'center' });
//   d.fontSize(8).text('ORIGINAL FOR RECIPIENT', { align: 'right' });
//   d.moveDown();

//   // ===== CUSTOMER & INVOICE DETAILS =====
//   d.fontSize(9);
//   d.text(`Customer Name : ${sale.customerName}`);
//   d.text(`Address : ${sale.customerAddress}`);
//   d.text(`GSTIN : ${sale.customerGstin}`);
//   d.text(`Place of Supply : ${sale.placeOfSupply}`);
//   d.moveUp(4);

//   d.text(`Invoice No : ${sale.invoiceNo}`, 350);
//   d.text(`Invoice Date : ${sale.invoiceDate}`, 350);
//   d.text(`Challan No : ${sale.challanNo}`, 350);
//   d.text(`Challan Date : ${sale.challanDate}`, 350);
//   d.text(`E-Way Bill No : ${sale.ewayBill}`, 350);
//   d.text(`Transport : ${sale.transport}`, 350);
//   d.text(`Transport ID : ${sale.transportId}`, 350);

//   d.moveDown(2);

//   // ===== TABLE HEADER =====
//   const tableTop = d.y;
//   const col = [40, 70, 230, 290, 330, 380, 440, 500];

//   d.fontSize(9).text('Sr', col[0], tableTop);
//   d.text('Product / Service', col[1], tableTop);
//   d.text('HSN', col[2], tableTop);
//   d.text('Qty', col[3], tableTop);
//   d.text('Rate', col[4], tableTop);
//   d.text('Taxable', col[5], tableTop);
//   d.text('IGST', col[6], tableTop);
//   d.text('Total', col[7], tableTop);

//   d.moveDown(0.5);
//   d.moveTo(40, d.y).lineTo(555, d.y).stroke();

//   // ===== ITEMS =====
//   let y = d.y + 5;
//   sale.items.forEach((it, i) => {
//     d.text(i + 1, col[0], y);
//     d.text(it.name, col[1], y);
//     d.text(it.hsn, col[2], y);
//     d.text(it.qty, col[3], y);
//     d.text(it.rate.toFixed(2), col[4], y);
//     d.text(it.taxable.toFixed(2), col[5], y);
//     d.text(`${it.gstPercent}%`, col[6], y);
//     d.text(it.total.toFixed(2), col[7], y);
//     y += 18;
//   });

//   d.moveDown(2);

//   // ===== TOTALS =====
//   d.text(`Taxable Amount : ₹${sale.taxableAmount?.toFixed(2)}`, { align: 'right' });
//   d.text(`Add : IGST : ₹${sale.igstAmount?.toFixed(2)}`, { align: 'right' });
//   d.fontSize(11).text(`Total Amount After Tax : ₹${sale.grandTotal?.toFixed(2)}`, {
//     align: 'right',
//   });

//   d.moveDown();

//   // ===== AMOUNT IN WORDS =====
//   d.fontSize(9).text(`Total in words : ${sale.amountInWords}`);

//   d.moveDown();

//   // ===== BANK DETAILS =====
//   d.text('Bank Details');
//   d.text(`Bank : ${sale.bank.name}`);
//   d.text(`Branch : ${sale.bank.branch}`);
//   d.text(`Account No : ${sale.bank.account}`);
//   d.text(`IFSC : ${sale.bank.ifsc}`);
//   d.text(`UPI ID : ${sale.bank.upi}`);

//   d.moveDown();

//   // ===== TERMS =====
//   d.text('Terms and Conditions');
//   d.text('Subject to jurisdiction.');
//   d.text('Goods once sold will not be taken back.');
//   d.text('Delivery Ex-Premises.');

//   d.moveDown(2);

//   // ===== SIGNATURE =====
//   d.text('Certified that the particulars given above are true and correct.');
//   d.moveDown();
//   d.text(`For ${sale.companyName}`, { align: 'right' });
//   d.text('Authorised Signatory', { align: 'right' });

//   return d;
// };

// module.exports = genInvoice;
