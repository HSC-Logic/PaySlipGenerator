export interface Company { name: string; address: string; telephone: string; email: string; registrationNumber: string; logo: string; authorizedName: string; authorizedDesignation: string; themeColor: string }
/** Browser-local defaults applied to newly created payment slips. */
export type CompanyProfile = Company
export interface Recipient { name: string; identification: string; role: string; address: string; email: string; telephone: string }
/** Reusable browser-local recipient details. Identification is intentionally excluded. */
export interface SavedRecipient { id: string; name: string; role: string; address: string; email: string; telephone: string }
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque' | 'Other'
export type CurrencyCode = 'LKR' | 'USD' | 'EUR' | 'GBP' | 'INR' | 'AUD' | 'CAD' | 'SGD'
export type PaperSize = 'a4' | 'a5' | 'b5' | 'letter'
export type PageOrientation = 'portrait' | 'landscape'
export interface Payment { date: string; reference: string; title: string; method: PaymentMethod; bankName: string; transactionReference: string; notes: string; adjustment: number | ''; currency: CurrencyCode; sealText: string; paperSize: PaperSize; orientation: PageOrientation }
export interface PaymentItem { id: string; description: string; quantity: number | ''; rate: number | '' }
export type AdjustmentKind = 'discount' | 'tax' | 'service' | 'delivery' | 'charge'
export type AdjustmentMode = 'percentage' | 'fixed'
export interface TotalAdjustment { id: string; label: string; kind: AdjustmentKind; mode: AdjustmentMode; value: number | '' }
export interface PaymentSlip { company: Company; recipient: Recipient; payment: Payment; items: PaymentItem[]; adjustments: TotalAdjustment[] }
export interface GoogleDriveState { connected: boolean; folderId: string; folderName: string; documentUrl: string }
export type Errors = Record<string, string>
export type WorkflowStep = 'company' | 'recipient' | 'payment' | 'review'
