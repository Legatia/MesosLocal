import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import idlJson from "./idl.json";

// Program ID from the IDL
export const PROGRAM_ID = new PublicKey(idlJson.address);

// Devnet USDC Mint
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Exchange rate
export const USDC_TO_PLN_RATE = 4;

// Seeds for PDAs
export const VAULT_SEED = Buffer.from("vault");
export const WHITELIST_SEED = Buffer.from("whitelist");
export const PLN_MINT_SEED = Buffer.from("pln_mint");

// Get the connection
export function getConnection(): Connection {
    return new Connection(clusterApiUrl("devnet"), "confirmed");
}

// Get the program
export function getProgram(provider: AnchorProvider): Program {
    return new Program(idlJson as Idl, provider);
}

// Get Vault PDA
export function getVaultPda(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [VAULT_SEED, authority.toBuffer()],
        PROGRAM_ID
    );
}

// Get PLN Mint PDA
export function getVoucherMintPda(vault: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [PLN_MINT_SEED, vault.toBuffer()],
        PROGRAM_ID
    );
}

// Get Whitelist Entry PDA
export function getWhitelistEntryPda(
    vault: PublicKey,
    merchant: PublicKey
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [WHITELIST_SEED, vault.toBuffer(), merchant.toBuffer()],
        PROGRAM_ID
    );
}

// Helper to get associated token address
export async function getATA(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    return getAssociatedTokenAddress(mint, owner, true);
}

// Format USDC amount (6 decimals)
export function formatUsdc(amount: number | bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
}

// Format PLNc amount (6 decimals)
export function formatPln(amount: number | bigint): string {
    return (Number(amount) / 1_000_000).toFixed(2);
}

// Parse USDC input to lamports (6 decimals)
export function parseUsdc(amount: string): BN {
    return new BN(Math.floor(parseFloat(amount) * 1_000_000));
}

// Parse PLN input to lamports (6 decimals)
export function parsePln(amount: string): BN {
    return new BN(Math.floor(parseFloat(amount) * 1_000_000));
}

export { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID };
