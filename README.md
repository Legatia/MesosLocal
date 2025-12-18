# MesosLocal
The Global "Limited Network" Settlement Rail for B2B Logistics
# 📄 Executive Summary
We are building a closed-loop B2B payment rail specifically for the global logistics industry.
Instead of functioning as a "Crypto Bank" (which is slow, expensive, and regulated), we operate as a Voucher Issuer. We enable Crypto-Native Companies (DePIN, Mining, Tech) to pay Real-World Logistics Providers (Truckers, Ports, Warehouses) instantly using USDC, while ensuring full regulatory compliance through a Restricted Voucher Model.

# 🪙 Token Naming Convention
Each voucher token follows the pattern: **`[CURRENCY][VERTICAL]`**

We focus on **emerging market currencies** where stablecoins don't exist yet:

| Token | Region | Vertical | Restricted To |
|-------|--------|----------|---------------|
| `PLNLOG` | 🇵🇱 Poland | Logistics | Fuel, Freight, Warehousing |
| `BRLLOG` | 🇧🇷 Brazil | Logistics | Fuel, Freight, Warehousing |
| `MXNLOG` | 🇲🇽 Mexico | Logistics | Fuel, Freight, Warehousing |
| `PLNMFG` | 🇵🇱 Poland | Manufacturing | Raw materials, Components |

> **Note**: We don't mint USD or EUR vouchers — clients can use USDC/EURC directly for those.

# 🏗 System Architecture
We utilize Solana for its speed and "PayFi" capabilities, leveraging Token-2022 extensions to enforce compliance at the protocol level.
## 1. The Core Engine: "The Sovereign Vault"
A custom Solana Program (Smart Contract) that acts as the Minting Authority.
 * Collateral: 100% USDC backed.
 * Minting Logic: Users deposit USDC \rightarrow Contract mints Voucher (or LogisticsPoints) at a hard-coded Oracle rate.
 * Redemption:
   * Users: Cannot redeem for cash (Strict One-Way flow).
   * Merchants: Can redeem for Fiat settlement (B2B Settlement).
## 2. The Token: Solana Token-2022 (SPL)
We do not use standard tokens. We use Token Extensions to enforce "Voucher" status code-side.
 * Extension A: Transfer Hooks
   * Function: Every transaction is checked before approval.
   * Rule: if receiver != whitelist_merchant { fail_transaction }.
   * Result: Prevents P2P transfers, ensuring the token cannot become "public money."
 * Extension B: Confidential Transfers (Optional)
   * Function: Encrypts the transaction amount using ZK-Proofs.
   * Result: Competitors cannot see how much a specific Trucking Company is getting paid, preserving B2B trade secrets.
## 3. The Transport Layer: Circle CCTP
 * Cross-Chain: We use Circle’s Cross-Chain Transfer Protocol to move the underlying USDC collateral between Solana, Base, and Ethereum without bridges.
 * Safety: We never wrap the voucher. We burn it, move the USDC, and re-mint on the destination chain.
# ⚖️ Regulatory Strategy: "The Limited Network"
We strictly avoid the definition of "E-Money" or "Payment Services" by adhering to the Limited Network Exclusion (LNE) globally.
| Region | Regulation Law | Our Exemption Strategy |
|---|---|---|
| 🇪🇺 EU / Poland | PSD2 / MiCA | Limited Network Exclusion: Our token is restricted to a specific category of goods (Fuel/Transport) and a limited network of contracted service providers. |
| 🇺🇸 USA | FinCEN (BSA) | Closed-Loop Prepaid Access: We limit wallet balances to <$2,000 and restrict usage to a defined merchant network, exempting us from Money Transmitter laws. |
| 🇸🇬 Singapore | Payment Services Act | Limited Purpose E-Money: Exempt from licensing as long as the total float is <$3.7M SGD. |
The 4 Golden Rules of Compliance:
 * No Cash Out for Users: Users can only spend tokens.
 * No P2P Transfers: Truckers cannot send tokens to each other.
 * Specific Goods Only: Smart Contract metadata restricts usage to "Logistics Expenses."
 * Merchant Settlement Only: Only verified B2B partners can convert tokens back to Fiat.
# 💰 Business Model
We replace the Factoring Bank and the Forex Broker simultaneously.
## 1. The Revenue Streams
 * Minting/Redemption Spread (0.5% - 1.0%): We charge a small fee when the client converts USDC \rightarrow Voucher, or when the Merchant converts Voucher \rightarrow Fiat.
   * Compare to: Banks charging 3-5% FX fees + Wire fees.
 * Float Interest (DeFi Yield): The USDC sitting in our Vault (waiting to be spent by truckers) is deployed into low-risk, liquid DeFi protocols (like Kamino or Jito) to earn ~4-5% APY.
## 2. The Value Proposition
 * For the Client (DePIN/Miner): "Pay your $100k shipping invoice in USDC instantly. Save 3% in FX fees. No banking headaches."
 * For the Logistics Provider: "Get paid on Day 1 (Instant Settlement) instead of Day 60. Use the credits for fuel or cash out to your bank."
## 🗺 Go-To-Market Strategy
### Phase 1: The "Hardware Beachhead"
 * Target: DePIN Hardware Distributors (Hivemapper, Helium) and Bitcoin Miners.
 * Tactic: Offer them a "Smart Invoice" tool to pay their logistics partners in USDC. We onboard the forwarders on their behalf.
### Phase 2: The "Fuel Card" Integration
 * Target: Mid-Market Polish Freight Forwarders.
 * Tactic: Integrate with a local Fuel Card provider (or become one). Allow truckers to spend Voucher directly at the pump, removing the need to off-ramp to a bank entirely.
## 🛠 Roadmap (Next 3 Steps)
### Legal Wrapper: Register as a VASP in Poland (Cost: ~600 PLN) to legally handle the crypto-to-fiat exchange for merchants.
### Tech MVP: Deploy the Solana Anchor Program with a simple "Whitelist" Transfer Hook.
### First Pilot: Sign ONE DePIN hardware distributor and their primary Freight Forwarder to process a single $10k invoice.
## ⚠️ Disclaimer
This project is a restricted B2B voucher system, not a public stablecoin. It is not available for retail speculation. All merchants must pass KYB (Know Your Business) verification.

---

# 🤖 AI Dispatcher Agent

A multi-tenant AI assistant powered by **Groq Cloud (Llama 3.1)** that:
- Parses natural language payment commands
- Provides balance and merchant queries
- Enforces per-business data isolation

## Quick Start
```bash
cd mesos_local/frontend
npm install
echo "GROQ_API_KEY=gsk_your_key" > .env.local
npm run dev
```

## Supported Commands
| Command | Response |
|---------|----------|
| `"Pay 50 to [address]"` | Parses amount + address for transfer |
| `"What's my balance?"` | Shows current vault balance |
| `"Who can I pay?"` | Lists registered merchants |
| `"Treasury status"` | Shows yield/idle funds |

## Multi-Tenant Isolation
Each connected wallet acts as a `tenantId`. The AI only receives context for that specific business:
- ✅ Tenant A cannot see Tenant B's data
- ✅ Audit logs track tenant + message
- ✅ Premium tier: Fully isolated instances (roadmap)

