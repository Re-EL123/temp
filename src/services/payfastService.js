/**
 * PayFast Service
 * Handles signature generation, ITN validation, and form building.
 *
 * Environment variables required:
 *   PAYFAST_MERCHANT_ID
 *   PAYFAST_MERCHANT_KEY
 *   PAYFAST_PASSPHRASE    (empty string for sandbox)
 *   PAYFAST_SANDBOX        ("true" or "false")
 *   PAYFAST_RETURN_URL
 *   PAYFAST_CANCEL_URL
 *   PAYFAST_NOTIFY_URL
 */

const crypto = require("crypto");
const https = require("https");
const dns = require("dns");

// ── Config ──────────────────────────────────────────────────────
const isSandbox = () =>
  (process.env.PAYFAST_SANDBOX || "true").toLowerCase() === "true";

const config = () => ({
  merchantId: isSandbox()
    ? "10000100"
    : process.env.PAYFAST_MERCHANT_ID,
  merchantKey: isSandbox()
    ? "46f0cd694581a"
    : process.env.PAYFAST_MERCHANT_KEY,
  passphrase: isSandbox()
    ? ""
    : process.env.PAYFAST_PASSPHRASE || "",
  processUrl: isSandbox()
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process",
  validateUrl: isSandbox()
    ? "https://sandbox.payfast.co.za/eng/query/validate"
    : "https://www.payfast.co.za/eng/query/validate",
  returnUrl:
    process.env.PAYFAST_RETURN_URL ||
    `${process.env.API_URL || "http://localhost:3000"}/api/payfast/return`,
  cancelUrl:
    process.env.PAYFAST_CANCEL_URL ||
    `${process.env.API_URL || "http://localhost:3000"}/api/payfast/cancel`,
  notifyUrl:
    process.env.PAYFAST_NOTIFY_URL ||
    `${process.env.API_URL || "http://localhost:3000"}/api/payfast/notify`,
});

// ── Valid PayFast server IPs (for ITN source verification) ──────
const PAYFAST_IPS = [
  "197.97.145.144",
  "197.97.145.145",
  "197.97.145.146",
  "197.97.145.147",
  "197.97.145.148",
  "197.97.145.149",
  "197.97.145.150",
  "197.97.145.151",
  // Sandbox
  "41.74.179.194",
  "41.74.179.195",
  "41.74.179.196",
  "41.74.179.197",
  "41.74.179.198",
  "41.74.179.199",
  "41.74.179.200",
  "41.74.179.201",
  "41.74.179.202",
  "41.74.179.203",
  "41.74.179.204",
  "41.74.179.205",
  "41.74.179.206",
  "41.74.179.207",
  "41.74.179.208",
  "41.74.179.209",
  "41.74.179.210",
];

// ── Signature generation ────────────────────────────────────────

/**
 * Generates an MD5 signature from a key-value data object.
 * PayFast requires params URL-encoded, joined with &, with
 * optional passphrase appended, then hashed with MD5.
 *
 * @param {Object} data - Key-value pairs (order matters)
 * @param {string|null} passphrase - Merchant passphrase (null/empty for sandbox)
 * @returns {string} MD5 hex signature
 */
function generateSignature(data, passphrase = null) {
  const params = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      return `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, "+")}`;
    })
    .join("&");

  const signatureString = passphrase
    ? `${params}&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`
    : params;

  return crypto.createHash("md5").update(signatureString).digest("hex");
}

// ── Build payment form data ─────────────────────────────────────

/**
 * Builds the full set of form fields for a PayFast payment,
 * including the computed signature.
 *
 * @param {Object} options
 * @param {string} options.paymentId  - Our internal payment ID
 * @param {number} options.amount     - Amount in ZAR
 * @param {string} options.itemName   - Description
 * @param {string} options.firstName  - Payer first name
 * @param {string} options.email      - Payer email
 * @returns {Object} { formData, processUrl, paymentId }
 */
function buildPaymentData({
  paymentId,
  amount,
  itemName = "Wallet Top Up",
  firstName = "",
  email = "",
}) {
  const cfg = config();

  // PayFast requires fields in a specific order for signature
  const data = {};
  data.merchant_id = cfg.merchantId;
  data.merchant_key = cfg.merchantKey;
  data.return_url = `${cfg.returnUrl}?pid=${paymentId}`;
  data.cancel_url = `${cfg.cancelUrl}?pid=${paymentId}`;
  data.notify_url = cfg.notifyUrl;

  if (firstName) data.name_first = firstName;
  if (email) data.email_address = email;

  data.m_payment_id = paymentId;
  data.amount = parseFloat(amount).toFixed(2);
  data.item_name = itemName;
  data.item_description = `Add R${parseFloat(amount).toFixed(2)} to wallet`;

  // Generate signature
  const signature = generateSignature(data, cfg.passphrase || null);
  data.signature = signature;

  return {
    formData: data,
    processUrl: cfg.processUrl,
    paymentId,
  };
}

/**
 * Builds a complete auto-submitting HTML page for the WebView.
 */
function buildPaymentHtml({
  paymentId,
  amount,
  itemName = "Wallet Top Up",
  firstName = "",
  email = "",
}) {
  const { formData, processUrl } = buildPaymentData({
    paymentId,
    amount,
    itemName,
    firstName,
    email,
  });

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const inputs = Object.entries(formData)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}" />`)
    .join("\n      ");

  return `<!DOCTYPE html>
<html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { display:flex; justify-content:center; align-items:center; height:100vh;
           margin:0; font-family:-apple-system,sans-serif; background:#f5f5f5 }
    .ld  { text-align:center; color:#5A0FC8 }
    .sp  { border:4px solid #e0e0e0; border-top:4px solid #5A0FC8; border-radius:50%;
           width:40px; height:40px; animation:s 1s linear infinite; margin:0 auto 16px }
    @keyframes s { to { transform:rotate(360deg) } }
  </style>
</head><body>
  <div class="ld">
    <div class="sp"></div>
    <p>Redirecting to PayFast…</p>
    <p style="font-size:12px;color:#999">R ${parseFloat(amount).toFixed(2)}</p>
  </div>
  <form id="pf" method="POST" action="${processUrl}">
    ${inputs}
  </form>
  <script>setTimeout(function(){ document.getElementById('pf').submit(); }, 800);</script>
</body></html>`;
}

// ── ITN Validation ──────────────────────────────────────────────

/**
 * Validate the source IP of an ITN request.
 */
function validateItnSourceIp(ip) {
  // Strip IPv6 prefix
  const cleanIp = ip.replace("::ffff:", "");

  if (isSandbox()) {
    console.log(`🔍 Sandbox mode – skipping IP check (${cleanIp})`);
    return true;
  }

  const valid = PAYFAST_IPS.includes(cleanIp);
  if (!valid) {
    console.warn(`⚠️  ITN from untrusted IP: ${cleanIp}`);
  }
  return valid;
}

/**
 * Verify the ITN signature matches.
 *
 * @param {Object} itnData - req.body from PayFast
 * @param {string|null} passphrase
 * @returns {boolean}
 */
function validateItnSignature(itnData, passphrase = null) {
  const receivedSig = itnData.signature;
  if (!receivedSig) return false;

  // Remove signature from data before computing
  const dataWithoutSig = { ...itnData };
  delete dataWithoutSig.signature;

  const computed = generateSignature(dataWithoutSig, passphrase);
  const matches = computed === receivedSig;

  if (!matches) {
    console.warn("⚠️  ITN signature mismatch");
    console.warn("   Received:", receivedSig);
    console.warn("   Computed:", computed);
  }

  return matches;
}

/**
 * Validate payment amounts match.
 */
function validateItnAmount(itnAmount, expectedAmount) {
  const received = parseFloat(itnAmount);
  const expected = parseFloat(expectedAmount);
  const matches = Math.abs(received - expected) < 0.01;

  if (!matches) {
    console.warn(
      `⚠️  ITN amount mismatch: received ${received}, expected ${expected}`
    );
  }

  return matches;
}

/**
 * Confirm the payment with PayFast servers (server-to-server POST).
 * PayFast recommends this step to prevent spoofed ITNs.
 *
 * @param {Object} itnData - raw POST body from PayFast
 * @returns {Promise<boolean>}
 */
function confirmWithPayfast(itnData) {
  return new Promise((resolve) => {
    try {
      const dataWithoutSig = { ...itnData };
      delete dataWithoutSig.signature;

      const postData = Object.entries(dataWithoutSig)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(
          ([k, v]) =>
            `${k}=${encodeURIComponent(String(v).trim()).replace(/%20/g, "+")}`
        )
        .join("&");

      const cfg = config();
      const urlObj = new URL(cfg.validateUrl);

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const result = body.trim().toUpperCase();
          console.log(`🔍 PayFast validation response: "${result}"`);
          resolve(result === "VALID");
        });
      });

      req.on("error", (err) => {
        console.error("❌ PayFast validation request failed:", err.message);
        // In sandbox, still allow
        resolve(isSandbox());
      });

      req.write(postData);
      req.end();
    } catch (err) {
      console.error("❌ PayFast validation error:", err.message);
      resolve(isSandbox());
    }
  });
}

// ── Export ───────────────────────────────────────────────────────
module.exports = {
  config,
  isSandbox,
  generateSignature,
  buildPaymentData,
  buildPaymentHtml,
  validateItnSourceIp,
  validateItnSignature,
  validateItnAmount,
  confirmWithPayfast,
};
