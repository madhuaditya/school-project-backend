// const Sale = require('../models/Sale');
// const genInvoice = require('../utils/invoice');

// const downloadInvoice = async (req, res) => {
//   const sale = await Sale.findById(req.params.id);
//   if (!sale) return res.sendStatus(404);

// //   if (
// //     req.user.role === 'manager' &&
// //     sale.manager.toString() !== req.user.id
// //   ) {
// //     return res.sendStatus(403);
// //   }

//   res.setHeader('Content-Type', 'application/pdf');
//   res.setHeader(
//     'Content-Disposition',
//     `attachment; filename=invoice-${sale.billNo}.pdf`
//   );

//   const pdf = genInvoice(sale);
//   pdf.pipe(res);
//   pdf.end();
// };

// module.exports = { downloadInvoice };
