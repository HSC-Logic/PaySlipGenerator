# PDF and Print Manual QA Matrix

Use one identical representative slip for every row. Include a logo, long company and recipient names, a multi-line address, at least 12 line items with wrapping descriptions, discounts/taxes/charges, bank and transaction details, long notes, authorization details, and a seal.

Run `npm test` and `npm run build` before beginning. For Print, confirm that the browser print preview shows the generated PDF rather than the application interface. Printer hardware is not required.

| Format | Preview | PDF | Print | Logo | Wrapping | Table | Totals | Notes | Footer | Multi-page |
|---|---|---|---|---|---|---|---|---|---|---|
| A4 Portrait | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| A4 Landscape | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| A5 Portrait | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| A5 Landscape | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| B5 Portrait | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| B5 Landscape | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Letter Portrait | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| Letter Landscape | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

## Acceptance checks

- Preview: selected format and orientation are shown; all entered information remains represented.
- PDF: physical dimensions match the selection and portrait/landscape axes are correct.
- Print: the PDF opens in print preview with the same dimensions, content, and pagination as Download.
- Logo: aspect ratio is preserved and surrounding text remains readable.
- Wrapping: names, addresses, references, purpose, and descriptions do not overlap or disappear.
- Table: headings repeat after automatic page breaks; rows retain their input order.
- Totals: subtotal, every adjustment, and final total agree with the form.
- Notes: long notes continue onto later pages without truncation.
- Footer: footer and payment reference remain inside every page boundary.
- Multi-page: there is no empty trailing page; acknowledgement, signatures, and seal remain present.

Record browser name/version, operating system, date, tester, and any failed cell with a screenshot or saved PDF before release approval.
