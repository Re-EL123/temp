PARENT TOP-UP
═══════════════════════════════════════════════════════════════

 ┌──────────┐   POST /api/wallet/topup   ┌──────────┐
 │  Mobile  │ ──────────────────────────► │  Backend │
 │   App    │   { amount: 200 }          │          │
 │          │ ◄────────────────────────── │  Creates │
 │          │   { payFastHtml, paymentId } │  Wallet  │
 │          │                             │  Txn     │
 │          │                             │  PFPay   │
 └────┬─────┘                             └──────────┘
      │
      │  Opens WebView with HTML
      │  (auto-submits form to PayFast)
      ▼
 ┌──────────┐
 │ PayFast  │  User completes card/EFT payment
 │ Checkout │
 └────┬─────┘
      │
      ├──── Redirect ──► GET /api/payfast/return?pid=xxx
      │                  (WebView detects URL → closes modal)
      │
      └──── ITN ──────► POST /api/payfast/notify
                         (server-to-server, no auth)
                         │
                         ▼
                    ┌──────────────┐
                    │ Validate:    │
                    │  1. IP       │
                    │  2. Signature│
                    │  3. Amount   │
                    │  4. Confirm  │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Credit wallet│
                    │ Update Txn   │
                    │ Update PFPay │
                    └──────────────┘


DRIVER WITHDRAWAL
═══════════════════════════════════════════════════════════════

 ┌──────────┐  POST /api/wallet/withdraw  ┌──────────┐
 │  Driver  │ ──────────────────────────► │  Backend │
 │   App    │  { amount, bankDetails }    │          │
 │          │ ◄────────────────────────── │ Debit    │
 │          │  { reference, newBalance }  │ wallet   │
 └──────────┘                             │ Create   │
                                          │ Txn      │
                                          └────┬─────┘
                                               │
                                          Admin reviews
                                          & processes EFT
                                          (1-3 business days)
