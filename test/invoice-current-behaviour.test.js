const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function orderFrom(items, coupon, ledgerTotals) {
  return {
    id: 9001,
    date: '22/11/2026',
    customer: 'Characterization Customer',
    paymentMode: 'cash',
    status: 'completed',
    items,
    coupon,
    subtotal: ledgerTotals.subtotal,
    discount: ledgerTotals.discount,
    tax: ledgerTotals.tax,
    total: ledgerTotals.total
  };
}

test('CURRENT BEHAVIOUR: pricing applies the HSN slab to the discounted line value', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const totals = pricing.computeTotals(items, 'SAVE10');

  assert.deepStrictEqual({
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    tax: totals.tax,
    total: totals.total,
    gstPercent: totals.lines[0].gstPercent
  }, {
    subtotal: 600,
    discount: 60,
    taxable: 540,
    tax: 27,
    total: 567,
    gstPercent: 5
  });
});

test('CURRENT BEHAVIOUR: invoice uses the HSN rate and pre-tax coupon discount', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  const order = orderFrom(items, 'SAVE10', ledgerTotals);
  const figures = invoice.computeInvoiceFigures(order);

  assert.deepStrictEqual({
    invoiceTax: figures.tax,
    invoiceGstPercent: figures.rows[0].gstPercent,
    invoiceDiscount: figures.discount,
    invoiceTotal: figures.total
  }, {
    invoiceTax: 27,
    invoiceGstPercent: 5,
    invoiceDiscount: 60,
    invoiceTotal: 567
  });
});

test('CURRENT BEHAVIOUR: reconciliation matches invoice and ledger totals', () => {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 1 }];
  const ledgerTotals = pricing.computeTotals(items, 'SAVE10');
  const result = reports.getGstReconciliation({
    orders: [orderFrom(items, 'SAVE10', ledgerTotals)]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 27);
  assert.equal(result.rows[0].invoiceTax, 27);
  assert.equal(result.rows[0].ledgerTotal, 567);
  assert.equal(result.rows[0].invoiceTotal, 567);
  assert.equal(result.rows[0].matched, true);
});
