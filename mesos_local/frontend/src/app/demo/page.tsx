"use client";

import DispatcherAgent from "@/components/DispatcherAgent";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    getAccount,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import Link from "next/link";
import idlJson from "@/lib/idl.json";

// Constants
const PROGRAM_ID = new PublicKey(idlJson.address);
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const VAULT_SEED = Buffer.from("vault");
const VOUCHER_MINT_SEED = Buffer.from("voucher_mint");
const ROLE_SEED = Buffer.from("role");

// Demo vault authority (will be initialized if not exists)
const DEMO_AUTHORITY = new PublicKey("GkXn6PUbcvpwAzVBbbVnXnLjTvDt9oivq1dMeVxxmyFs");

interface TransactionResult {
    status: "success" | "error";
    message: string;
    signature?: string;
}

export default function DemoPage() {
    const { connection } = useConnection();
    const wallet = useWallet();

    const [usdcBalance, setUsdcBalance] = useState<string>("0.00");
    const [voucherBalance, setVoucherBalance] = useState<string>("0.00");
    const [vaultInfo, setVaultInfo] = useState<any>(null);
    const [voucherMint, setVoucherMint] = useState<PublicKey | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TransactionResult | null>(null);
    const [vaultAuthority, setVaultAuthority] = useState<PublicKey | null>(null);

    // Demo inputs
    const [depositAmount, setDepositAmount] = useState("10");
    const [transferAmount, setTransferAmount] = useState("20");
    const [recipientAddress, setRecipientAddress] = useState("");
    const [unregisteredAddress, setUnregisteredAddress] = useState("");

    // Role registration state
    const [isClientRegistered, setIsClientRegistered] = useState(false);
    const [isMerchantRegistered, setIsMerchantRegistered] = useState(false);

    // Voucher configuration
    const [selectedCountry, setSelectedCountry] = useState("PL");
    const [voucherIdentifier, setVoucherIdentifier] = useState("LOG");

    // Country exchange rates (USD to local currency)
    const COUNTRIES = [
        { code: "PL", name: "Poland", currency: "PLN", rate: 4.02, flag: "🇵🇱" },
        { code: "BR", name: "Brazil", currency: "BRL", rate: 6.12, flag: "🇧🇷" },
        { code: "MX", name: "Mexico", currency: "MXN", rate: 17.38, flag: "🇲🇽" },
        { code: "IN", name: "India", currency: "INR", rate: 84.50, flag: "🇮🇳" },
        { code: "PH", name: "Philippines", currency: "PHP", rate: 58.20, flag: "🇵🇭" },
        { code: "NG", name: "Nigeria", currency: "NGN", rate: 1580.00, flag: "🇳🇬" },
        { code: "ZA", name: "South Africa", currency: "ZAR", rate: 17.95, flag: "🇿🇦" },
        { code: "TH", name: "Thailand", currency: "THB", rate: 34.80, flag: "🇹🇭" },
    ];

    const selectedCountryData = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
    const voucherName = `${selectedCountryData.currency}${voucherIdentifier}`;

    // Get program
    const getProgram = useCallback(() => {
        if (!wallet.publicKey || !wallet.signTransaction) return null;

        const provider = new AnchorProvider(
            connection,
            wallet as any,
            { commitment: "confirmed" }
        );

        return new Program(idlJson as any, provider);
    }, [connection, wallet.publicKey]);

    // Get PDAs
    const getVaultPda = (authority: PublicKey): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync([VAULT_SEED, authority.toBuffer()], PROGRAM_ID);
    };

    const getVoucherMintPda = (vault: PublicKey): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync([VOUCHER_MINT_SEED, vault.toBuffer()], PROGRAM_ID);
    };

    const getRolePda = (vault: PublicKey, address: PublicKey): [PublicKey, number] => {
        return PublicKey.findProgramAddressSync(
            [ROLE_SEED, vault.toBuffer(), address.toBuffer()],
            PROGRAM_ID
        );
    };

    // Fetch balances
    const fetchBalances = useCallback(async () => {
        if (!wallet.publicKey) return;

        try {
            // Fetch USDC balance
            const usdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
            try {
                const usdcAccount = await getAccount(connection, usdcAta);
                setUsdcBalance((Number(usdcAccount.amount) / 1_000_000).toFixed(2));
            } catch {
                setUsdcBalance("0.00");
            }

            // Fetch PLN balance if mint exists
            if (voucherMint) {
                const voucherAta = await getAssociatedTokenAddress(voucherMint, wallet.publicKey);
                try {
                    const voucherAccount = await getAccount(connection, voucherAta);
                    setVoucherBalance((Number(voucherAccount.amount) / 1_000_000).toFixed(2));
                } catch {
                    setVoucherBalance("0.00");
                }
            }
        } catch (e) {
            console.error("Error fetching balances:", e);
        }
    }, [wallet.publicKey, connection, voucherMint]);

    // Fetch vault info
    // Fetch vault info - Checks active wallet first, then DEMO_AUTHORITY
    const fetchVaultInfo = useCallback(async () => {
        const program = getProgram();
        if (!program || !wallet.publicKey) return;

        try {
            // 1. Try checking if the connected wallet has a vault
            let vault;
            let authority = wallet.publicKey;

            try {
                const [userVaultPda] = getVaultPda(wallet.publicKey);
                vault = await (program.account as any).vault.fetch(userVaultPda);
            } catch (e) {
                // User doesn't have a vault, try DEMO_AUTHORITY
                try {
                    const [demoVaultPda] = getVaultPda(DEMO_AUTHORITY);
                    vault = await (program.account as any).vault.fetch(demoVaultPda);
                    authority = DEMO_AUTHORITY;
                } catch (innerE) {
                    // No vault found at all
                }
            }

            if (vault) {
                setVaultInfo(vault);
                // Only update stable state if changed
                if (!voucherMint || !vault.voucherMint.equals(voucherMint)) {
                    setVoucherMint(vault.voucherMint);
                }
                if (!vaultAuthority || !authority.equals(vaultAuthority)) {
                    setVaultAuthority(authority);
                }
            } else {
                setVaultInfo(null);
                setVaultAuthority(null);
            }

        } catch (e) {
            console.error("Error fetching vault:", e);
        }
    }, [getProgram, wallet.publicKey, voucherMint, vaultAuthority]);

    useEffect(() => {
        if (wallet.connected) {
            fetchBalances();
            fetchVaultInfo();
        }
    }, [wallet.connected, fetchBalances, fetchVaultInfo]);

    // Initialize vault (if not exists) - for demo purposes
    const initializeVault = async () => {
        if (!wallet.publicKey) return;

        setLoading(true);
        setResult(null);
        console.log("Starting initializeVault...");

        try {
            const program = getProgram();
            if (!program) throw new Error("Program not initialized");

            const [vaultPda] = getVaultPda(wallet.publicKey);
            const [voucherMintPda] = getVoucherMintPda(vaultPda);

            const tx = await program.methods
                .initializeVault()
                .accountsStrict({
                    vault: vaultPda,
                    voucherMint: voucherMintPda,
                    usdcMint: USDC_MINT,
                    authority: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();

            console.log("Vault initialized successfully. Signature:", tx);

            setResult({
                status: "success",
                message: "Vault initialized successfully!",
                signature: tx,
            });

            await fetchVaultInfo();
        } catch (e: any) {
            console.error("Initialize error:", e);
            setResult({
                status: "error",
                message: e.message || "Failed to initialize vault",
            });
        } finally {
            setLoading(false);
        }
    };

    // Deposit USDC (mock - would need actual USDC on devnet)
    const depositUsdc = async () => {
        if (!wallet.publicKey || !vaultInfo || !voucherMint) {
            setResult({
                status: "error",
                message: "Please connect wallet and ensure vault is initialized",
            });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const program = getProgram();
            if (!program) throw new Error("Program not initialized");

            const amount = new BN(parseFloat(depositAmount) * 1_000_000);
            const [vaultPda] = getVaultPda(vaultAuthority || DEMO_AUTHORITY);

            const userUsdcAta = await getAssociatedTokenAddress(USDC_MINT, wallet.publicKey);
            const userVoucherAta = await getAssociatedTokenAddress(voucherMint, wallet.publicKey);
            const vaultUsdcAta = await getAssociatedTokenAddress(USDC_MINT, vaultPda, true);

            const tx = await program.methods
                .depositUsdc(amount)
                .accountsStrict({
                    vault: vaultPda,
                    voucherMint: voucherMint,
                    usdcMint: USDC_MINT,
                    user: wallet.publicKey,
                    userUsdcAccount: userUsdcAta,
                    userVoucherAccount: userVoucherAta,
                    vaultUsdcAccount: vaultUsdcAta,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Deposit successful. Signature:", tx);

            const voucherAmount = parseFloat(depositAmount) * 4;

            setResult({
                status: "success",
                message: `Deposited ${depositAmount} USDC → Minted ${voucherAmount.toFixed(2)} Voucher`,
                signature: tx,
            });

            await fetchBalances();
        } catch (e: any) {
            console.error(e);
            setResult({
                status: "error",
                message: e.message?.includes("0x1")
                    ? "Insufficient USDC balance. Get devnet USDC from a faucet."
                    : e.message || "Failed to deposit",
            });
        } finally {
            setLoading(false);
        }
    };

    // Transfer voucher (with role-based access control)
    const transferPln = async (toRegistered: boolean) => {
        if (!wallet.publicKey || !vaultInfo || !voucherMint) {
            setResult({
                status: "error",
                message: "Please connect wallet and ensure vault is initialized",
            });
            return;
        }

        // Validate addresses
        const targetAddress = toRegistered ? recipientAddress : unregisteredAddress;
        if (!targetAddress) {
            setResult({
                status: "error",
                message: toRegistered
                    ? "Please enter a merchant address first"
                    : "Please enter an unregistered address first",
            });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const program = getProgram();
            if (!program) throw new Error("Program not initialized");

            const amount = new BN(parseFloat(transferAmount) * 1_000_000);
            const [vaultPda] = getVaultPda(vaultAuthority || DEMO_AUTHORITY);

            const recipientPubkey = new PublicKey(targetAddress);

            // Get role PDAs for sender (client) and recipient
            const [senderRolePda] = getRolePda(vaultPda, wallet.publicKey);
            const [recipientRolePda] = getRolePda(vaultPda, recipientPubkey);

            const senderVoucherAta = await getAssociatedTokenAddress(voucherMint, wallet.publicKey);
            const recipientVoucherAta = await getAssociatedTokenAddress(voucherMint, recipientPubkey);

            const tx = await program.methods
                .transferPln(amount)
                .accountsStrict({
                    vault: vaultPda,
                    voucherMint: voucherMint,
                    senderRole: senderRolePda,
                    recipientRole: recipientRolePda,
                    sender: wallet.publicKey,
                    recipient: recipientPubkey,
                    senderVoucherAccount: senderVoucherAta,
                    recipientVoucherAccount: recipientVoucherAta,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Transfer successful. Signature:", tx);

            setResult({
                status: "success",
                message: `✅ Transferred ${transferAmount} ${voucherName} to ${toRegistered ? "registered merchant" : "address"}`,
                signature: tx,
            });

            await fetchBalances();
        } catch (e: any) {
            console.error(e);

            // Check for role-based errors
            const isRoleError = e.message?.includes("OnlyClientCanSend") ||
                e.message?.includes("OnlyMerchantCanReceive") ||
                e.message?.includes("NotRegistered") ||
                e.message?.includes("AccountNotInitialized") ||
                e.logs?.some((log: string) => log.includes("role") || log.includes("Client") || log.includes("Merchant"));

            if (isRoleError) {
                setResult({
                    status: "error",
                    message: "❌ BLOCKED: Transfer rejected! Either you're not registered as Client, or recipient is not registered as Merchant. Vouchers are safe in your wallet.",
                });
            } else {
                setResult({
                    status: "error",
                    message: e.message || "Transfer failed",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Register current wallet as Client (so they can send vouchers)
    const registerAsClient = async () => {
        if (!wallet.publicKey || !vaultInfo) return;

        setLoading(true);
        setResult(null);

        try {
            const program = getProgram();
            if (!program) throw new Error("Program not initialized");

            const [vaultPda] = getVaultPda(vaultAuthority || DEMO_AUTHORITY);

            const [rolePda] = getRolePda(vaultPda, wallet.publicKey);

            const tx = await program.methods
                .addClient(wallet.publicKey)
                .accountsStrict({
                    vault: vaultPda,
                    roleEntry: rolePda,
                    authority: vaultAuthority || DEMO_AUTHORITY,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setIsClientRegistered(true);
            setResult({
                status: "success",
                message: `✅ You are now registered as Client`,
                signature: tx,
            });
        } catch (e: any) {
            // If already registered, that's okay
            if (e.message?.includes("already in use")) {
                setIsClientRegistered(true);
                setResult({
                    status: "success",
                    message: "✅ You are already registered as Client",
                });
            } else {
                setResult({
                    status: "error",
                    message: e.message || "Failed to register as client",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // Register an address as Merchant (so they can receive vouchers)
    const registerAsMerchant = async (merchantAddress: string) => {
        if (!wallet.publicKey || !vaultInfo || !merchantAddress) return;

        setLoading(true);
        setResult(null);

        try {
            const program = getProgram();
            if (!program) throw new Error("Program not initialized");

            const [vaultPda] = getVaultPda(vaultAuthority || DEMO_AUTHORITY);
            const merchantPubkey = new PublicKey(merchantAddress);
            const [rolePda] = getRolePda(vaultPda, merchantPubkey);

            const tx = await program.methods
                .addMerchant(merchantPubkey)
                .accountsStrict({
                    vault: vaultPda,
                    roleEntry: rolePda,
                    authority: vaultAuthority || DEMO_AUTHORITY,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setIsMerchantRegistered(true);
            setResult({
                status: "success",
                message: `✅ Merchant ${merchantAddress.slice(0, 8)}... registered`,
                signature: tx,
            });
        } catch (e: any) {
            // If already registered, that's okay
            if (e.message?.includes("already in use")) {
                setIsMerchantRegistered(true);
                setResult({
                    status: "success",
                    message: `✅ Merchant ${merchantAddress.slice(0, 8)}... already registered`,
                });
            } else {
                setResult({
                    status: "error",
                    message: e.message || "Failed to register merchant",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden">
            {/* Animated gradient orbs */}
            <div className="gradient-orb orb-1" />
            <div className="gradient-orb orb-2" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center font-bold text-lg">
                        M
                    </div>
                    <span className="text-xl font-bold">MesosLocal</span>
                </Link>
                <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">Devnet</span>
                    <WalletMultiButton />
                </div>
            </header>

            {/* Demo Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT COLUMN: Dispatcher Agent (New "Invisible Interface") */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-24">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                                    AI Dispatcher
                                </h2>
                                <span className="text-xs px-2 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded">
                                    Privacy Mode: ON 🔒
                                </span>
                            </div>

                            {/* Always show Agent for Demo Interaction */}
                            <DispatcherAgent
                                onParseTransaction={(address, amount) => {
                                    setRecipientAddress(address);
                                    setTransferAmount(amount);
                                }}
                                onExecuteTransaction={() => transferPln(true)}
                                vaultBalance={usdcBalance}
                                isMerchantRegistered={(addr) => true}
                                tenantId={wallet.publicKey?.toBase58()}
                                tenantName="MesosLocal Demo"
                            />

                            <div className="mt-6 p-4 bg-slate-900/30 border border-slate-800 rounded-xl text-xs text-slate-500 leading-relaxed">
                                <strong className="text-slate-400">Why an Agent?</strong>
                                <br />
                                Instead of manual forms, dispatchers upload PDF invoices or type commands. The Agent handles compliance, privacy (Token-2022), and routine tasks.
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: The "Terminal" (Existing Demo UI) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Connection Gate used to be here, but we move it inside content or handle nicely */}
                        {!wallet.connected && (
                            <div className="glass-card p-12 text-center mb-6">
                                <h2 className="text-xl mb-4">Connect to View Terminal</h2>
                                <p className="text-slate-400 mb-6">Access the Sovereign Vault manual controls.</p>
                            </div>
                        )}
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Balances Card */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-semibold mb-4">Your Balances</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                                💵
                                            </div>
                                            <span className="font-medium">USDC</span>
                                        </div>
                                        <span className="text-xl font-bold">{usdcBalance}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                                {selectedCountryData.flag}
                                            </div>
                                            <span className="font-medium">{voucherName}</span>
                                        </div>
                                        <span className="text-xl font-bold">{voucherBalance}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={fetchBalances}
                                    className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
                                >
                                    ↻ Refresh Balances
                                </button>
                            </div>

                            {/* Vault Status */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-semibold mb-4">Vault Status</h2>
                                {vaultInfo ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Total USDC Deposited</span>
                                            <span>{(Number(vaultInfo.totalUsdcDeposited) / 1_000_000).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Total Voucher Minted</span>
                                            <span>{(Number(vaultInfo.totalPlnMinted) / 1_000_000).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Exchange Rate</span>
                                            <span>1 USDC = 4 Voucher</span>
                                        </div>
                                        <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20 text-green-400 text-sm">
                                            ✓ Vault Active
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-slate-400 text-sm mb-4">No vault initialized</p>
                                        <button
                                            onClick={initializeVault}
                                            disabled={loading}
                                            className="btn-primary w-full"
                                        >
                                            {loading ? <span className="spinner mx-auto" /> : "Initialize Vault"}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Deposit USDC */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-semibold mb-4">1. Configure & Mint Voucher</h2>
                                <div className="space-y-4">
                                    {/* Country Selection */}
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-2">Target Country</label>
                                        <select
                                            value={selectedCountry}
                                            onChange={(e) => setSelectedCountry(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-cyan-500 focus:outline-none appearance-none cursor-pointer"
                                        >
                                            {COUNTRIES.map((country) => (
                                                <option key={country.code} value={country.code} className="bg-slate-800">
                                                    {country.flag} {country.name} ({country.currency})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Voucher Identifier */}
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-2">Voucher Identifier (Industry/Merchant)</label>
                                        <input
                                            type="text"
                                            value={voucherIdentifier}
                                            onChange={(e) => setVoucherIdentifier(e.target.value.toUpperCase().slice(0, 10))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-cyan-500 focus:outline-none uppercase"
                                            placeholder="LOG, FREIGHT, TRUCKING..."
                                        />
                                        <p className="text-xs text-slate-500 mt-1">
                                            Examples: LOG (logistics), FREIGHT, TRUCKING, ACME (merchant name)
                                        </p>
                                    </div>

                                    {/* Voucher Name Preview */}
                                    <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-400">Your Voucher Token:</span>
                                            <span className="text-lg font-bold text-purple-400">{voucherName}</span>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-2">Amount (USDC)</label>
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-cyan-500 focus:outline-none"
                                            placeholder="10"
                                        />
                                    </div>

                                    {/* Exchange Rate Display */}
                                    <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-slate-400">Exchange Rate:</span>
                                            <span className="text-sm font-medium text-cyan-400">
                                                1 USD = {selectedCountryData.rate.toFixed(2)} {selectedCountryData.currency}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-400">You will receive:</span>
                                            <span className="text-lg font-bold text-cyan-400">
                                                {(parseFloat(depositAmount || "0") * selectedCountryData.rate).toFixed(2)} {voucherName}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={depositUsdc}
                                        disabled={loading || !vaultInfo}
                                        className="btn-primary w-full flex items-center justify-center gap-2"
                                    >
                                        {loading ? <span className="spinner" /> : null}
                                        Mint {voucherName} Vouchers
                                    </button>
                                </div>
                            </div>

                            {/* Transfer Demo */}
                            <div className="glass-card p-6">
                                <h2 className="text-lg font-semibold mb-4">2. Transfer Voucher (Role-Based Demo)</h2>
                                <div className="space-y-4">
                                    {/* Step 2a: Register yourself as Client */}
                                    <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                        <h3 className="text-sm font-medium text-cyan-400 mb-3">Step 2a: Register as Client</h3>
                                        <p className="text-xs text-slate-400 mb-3">
                                            You need to be registered as a Client to send vouchers.
                                        </p>
                                        <button
                                            onClick={registerAsClient}
                                            disabled={loading || !vaultInfo || isClientRegistered}
                                            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isClientRegistered
                                                ? "bg-green-500/20 border border-green-500/30 text-green-400 cursor-default"
                                                : "bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
                                                }`}
                                        >
                                            {loading ? <span className="spinner" /> : isClientRegistered ? "✓" : "→"}
                                            {isClientRegistered ? "Registered as Client" : "Register as Client"}
                                        </button>
                                    </div>

                                    {/* Step 2b: Register Merchant Address */}
                                    <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                        <h3 className="text-sm font-medium text-purple-400 mb-3">Step 2b: Register Merchant</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-slate-400 block mb-1">Merchant Wallet Address</label>
                                                <input
                                                    type="text"
                                                    value={recipientAddress}
                                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none font-mono"
                                                    placeholder="Enter merchant wallet address (e.g., J8HZV...)"
                                                />
                                            </div>
                                            <button
                                                onClick={() => registerAsMerchant(recipientAddress)}
                                                disabled={loading || !vaultInfo || !recipientAddress || isMerchantRegistered}
                                                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isMerchantRegistered
                                                    ? "bg-green-500/20 border border-green-500/30 text-green-400 cursor-default"
                                                    : "bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30"
                                                    }`}
                                            >
                                                {loading ? <span className="spinner" /> : isMerchantRegistered ? "✓" : "→"}
                                                {isMerchantRegistered ? "Merchant Registered" : "Register Merchant"}
                                            </button>
                                            <p className="text-xs text-slate-500">
                                                💡 In production, only the vault authority can register merchants.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Amount Input */}
                                    <div>
                                        <label className="text-sm text-slate-400 block mb-2">Transfer Amount ({voucherName})</label>
                                        <input
                                            type="number"
                                            value={transferAmount}
                                            onChange={(e) => setTransferAmount(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:border-cyan-500 focus:outline-none"
                                            placeholder="20"
                                        />
                                    </div>

                                    {/* Step 2c: Transfer Buttons */}
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-medium text-slate-300">Step 2c: Test Transfers</h3>

                                        {/* Success Transfer */}
                                        <button
                                            onClick={() => transferPln(true)}
                                            disabled={loading || !vaultInfo || !recipientAddress}
                                            className="w-full py-3 px-4 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 font-medium hover:bg-green-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <span className="spinner" /> : "✓"}
                                            Send to Registered Merchant
                                        </button>
                                        <p className="text-xs text-green-400/70 text-center">
                                            → Will succeed if you're registered as Client and recipient as Merchant
                                        </p>

                                        {/* Divider */}
                                        <div className="flex items-center gap-3 py-2">
                                            <div className="flex-1 h-px bg-white/10" />
                                            <span className="text-xs text-slate-500">vs</span>
                                            <div className="flex-1 h-px bg-white/10" />
                                        </div>

                                        {/* Unregistered Address Input */}
                                        <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                                            <label className="text-xs text-red-400 block mb-2">Your Other Wallet (Unregistered)</label>
                                            <input
                                                type="text"
                                                value={unregisteredAddress}
                                                onChange={(e) => setUnregisteredAddress(e.target.value)}
                                                className="w-full bg-white/5 border border-red-500/30 rounded-lg px-3 py-2 text-sm focus:border-red-500 focus:outline-none font-mono"
                                                placeholder="Enter your other wallet address..."
                                            />
                                        </div>

                                        {/* Failure Transfer */}
                                        <button
                                            onClick={() => transferPln(false)}
                                            disabled={loading || !vaultInfo || !unregisteredAddress}
                                            className="w-full py-3 px-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? <span className="spinner" /> : "✗"}
                                            Send to Unregistered Address
                                        </button>
                                        <p className="text-xs text-red-400/70 text-center">
                                            → Transfer will FAIL - address not registered as merchant
                                        </p>
                                    </div>

                                    {/* Info Box */}
                                    <div className="p-3 bg-slate-500/10 rounded-lg border border-slate-500/20">
                                        <p className="text-xs text-slate-400">
                                            <span className="font-medium text-slate-300">🔒 Role-Based Access:</span> Only registered Clients can send, and only to registered Merchants.
                                            Failed transfers are rejected on-chain — your vouchers are never at risk.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Result Display */}
                        {result && (
                            <div className={`mt-6 p-4 rounded-lg ${result.status === "success" ? "status-success" : "status-error"}`}>
                                <div className="font-medium">{result.message}</div>
                                {result.signature && (
                                    <a
                                        href={`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm underline mt-2 block"
                                    >
                                        View on Solana Explorer →
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Info Card */}
                        <div className="glass-card p-6 mt-8">
                            <h3 className="font-semibold mb-3">ℹ️ Demo Notes</h3>
                            <ul className="text-sm text-slate-400 space-y-2">
                                <li>• This demo runs on Solana devnet - no real funds are used</li>
                                <li>• You need devnet USDC to test deposits. Use a faucet or airdrop</li>
                                <li>• The "Transfer to Random Address" demonstrates the whitelist enforcement gate</li>
                                <li>• Exchange rate is hardcoded at 1 USDC = 4 Voucher</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
