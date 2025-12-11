# Capital Flow Example

A US Tech Company (Client) needs to pay a Polish Trucking Company (Merchant) an invoice of $10,000 USD (approx. 40,000 Voucher).
# 🎬 The Cast
 * The Payer (Client): A US DePIN distributor holding USDC.
 * The Platform (You): The Voucher Issuer (Vault & Smart Contract).
 * The Merchant (Trucker): A Polish freight company (Whitelisted).
 * The Partner: A Fiat Payout Provider (e.g., a VASP/Exchange partner).
# 🌊 The Flow: From USDC to Real Voucher
## Step 1: The Invoice (Day 0)
The Polish Trucker issues an invoice to the US Client.
 * Invoice Total: 40,000 Voucher (approx $10,000).
 * Metadata: Invoice #PL-992.
## Step 2: Issuance (The "Load" Event)
The US Client logs into your dashboard to pay the invoice.
 * Action: Client sends 10,000 USDC to your Solana Vault.
 * Smart Contract:
   * Locks the 10,000 USDC in the Reserve.
   * Mints 40,000 VoucherLOG (Logistics Vouchers) to the Client's Wallet.
 * Note: The Client now holds 40,000 VoucherLOG. They cannot cash this out. They can only send it to a Whitelisted address.
## Step 3: Payment (The "Restricted Transfer")
The US Client clicks "Pay Invoice #PL-992".
 * Action: Client sends 40,000 VoucherLOG to the Trucker’s Wallet.
 * Solana Transfer Hook (The Guard):
   * Check: Is the Receiver (Trucker) on the Whitelist? YES.
   * Result: Transaction Approved.
 * Time: < 1 Second.
 * Status: The Trucker sees "40,000 VoucherLOG" in their app instantly. The Client gets a "Paid" receipt.
## Step 4: Settlement (The "Cash Out" Event)
Now the Trucker has tokens, but they need to pay taxes (VAT) and drivers. They have two choices:
### Option A: Spend In-Network (Future: Fuel Card Integration)
 * The Trucker spends VoucherLOG at a Partner Merchant (also Whitelisted).
 * Result: Money stays in-loop. No conversion needed.
### Option B: Fiat Settlement via Licensed Partner
 * Action: Trucker clicks "Withdraw to Bank" in your app.
 * What Happens:
   1. Trucker burns 35,000 VoucherLOG → triggers our backend.
   2. We call our **Licensed Off-Ramp Partner** (e.g., Bridge.xyz, Ramp Network).
   3. Partner receives USDC from our vault + trucker's bank details.
   4. Partner handles USDC → Voucher conversion and wires to trucker's bank.
 * Result: Trucker receives **34,825 Voucher** (after 0.5% fee) in their bank account.
 * Time: Same day or T+1 depending on partner.

> **Why this is clean**: We never touch fiat. The licensed partner handles crypto-to-fiat conversion. They hold the EMI/Payment Institution license, not us.
# 📊 Summary of Balances
| Party | Start State | End State | Result |
|---|---|---|---|
| US Client | -$10,000 USDC | 0 | Invoice Paid instantly. No FX fees. |
| Your Vault | $0 | $2,500 USDC | You hold the collateral for the unspent vouchers (Option A). |
| Your Revenue | $0 | $50 (Fee) | Profit from the spread/fee. |
| Trucker | +Invoice (Unpaid) | +34,825 Voucher (Cash) 
 +5,000 VoucherLOG (Fuel) | Paid instantly. |
# 🔍 Why this is Legal (Compliance Check)
 * No "Money" Creation: You didn't print money. You issued a voucher backed by USDC.
 * No "Open Loop": The Client couldn't send the VoucherLOG to a friend. The Transfer Hook blocked it.
 * No "Banking" for Client: The Client couldn't withdraw the VoucherLOG to their bank. It was "Spend Only."
 * Merchant Settlement: Only the verified Merchant (Trucker) could convert to Fiat, which is standard "Merchant Acquiring" (like Stripe), not Banking.
