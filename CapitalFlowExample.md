# Capital Flow Example

A US Tech Company (Client) needs to pay a Polish Trucking Company (Merchant) an invoice of $10,000 USD (approx. 40,000 PLN).
# 🎬 The Cast
 * The Payer (Client): A US DePIN distributor holding USDC.
 * The Platform (You): The Voucher Issuer (Vault & Smart Contract).
 * The Merchant (Trucker): A Polish freight company (Whitelisted).
 * The Partner: A Fiat Payout Provider (e.g., a VASP/Exchange partner).
# 🌊 The Flow: From USDC to Real PLN
## Step 1: The Invoice (Day 0)
The Polish Trucker issues an invoice to the US Client.
 * Invoice Total: 40,000 PLN (approx $10,000).
 * Metadata: Invoice #PL-992.
## Step 2: Issuance (The "Load" Event)
The US Client logs into your dashboard to pay the invoice.
 * Action: Client sends 10,000 USDC to your Solana Vault.
 * Smart Contract:
   * Locks the 10,000 USDC in the Reserve.
   * Mints 40,000 PLNc (Logistics Vouchers) to the Client's Wallet.
 * Note: The Client now holds 40,000 PLNc. They cannot cash this out. They can only send it to a Whitelisted address.
## Step 3: Payment (The "Restricted Transfer")
The US Client clicks "Pay Invoice #PL-992".
 * Action: Client sends 40,000 PLNc to the Trucker’s Wallet.
 * Solana Transfer Hook (The Guard):
   * Check: Is the Receiver (Trucker) on the Whitelist? YES.
   * Result: Transaction Approved.
 * Time: < 1 Second.
 * Status: The Trucker sees "40,000 PLNc" in their app instantly. The Client gets a "Paid" receipt.
## Step 4: Settlement (The "Cash Out" Event)
Now the Trucker has tokens, but they need to pay taxes (VAT) and drivers. They have two choices:
### Option A: The "Closed Loop" Spend (No Fees)
 * The Trucker sends 5,000 PLNc to a Partner Fuel Station (also Whitelisted) to buy diesel.
 * Result: Money stays in the system. You hold the float longer.
### Option B: The Fiat Settlement (The Off-Ramp)
 * Action: Trucker clicks "Withdraw to Bank" in your app.
 * Blockchain Event: Trucker sends 35,000 PLNc to your Burn Address.
 * Your Backend System:
   * Detects the Burn.
   * Calculates the Fiat Value: 35,000 PLN.
   * Takes your fee (e.g., 0.5% = 175 PLN).
   * Unlocks the equivalent USDC from the Vault.
   * Sends USDC to your Fiat Partner.
 * Banking Event: The Fiat Partner converts USDC \rightarrow PLN and sends a Real Time Wire (Elixir/Express) to the Trucker’s Bank Account.
   * Advanced: If you have a sophisticated partner, you can execute a Split Payment here (Net Amount to Main Account, VAT Amount to VAT Account) to save the trucker administrative work.
# 📊 Summary of Balances
| Party | Start State | End State | Result |
|---|---|---|---|
| US Client | -$10,000 USDC | 0 | Invoice Paid instantly. No FX fees. |
| Your Vault | $0 | $2,500 USDC | You hold the collateral for the unspent vouchers (Option A). |
| Your Revenue | $0 | $50 (Fee) | Profit from the spread/fee. |
| Trucker | +Invoice (Unpaid) | +34,825 PLN (Cash) 
 +5,000 PLNc (Fuel) | Paid instantly. |
# 🔍 Why this is Legal (Compliance Check)
 * No "Money" Creation: You didn't print money. You issued a voucher backed by USDC.
 * No "Open Loop": The Client couldn't send the PLNc to a friend. The Transfer Hook blocked it.
 * No "Banking" for Client: The Client couldn't withdraw the PLNc to their bank. It was "Spend Only."
 * Merchant Settlement: Only the verified Merchant (Trucker) could convert to Fiat, which is standard "Merchant Acquiring" (like Stripe), not Banking.
