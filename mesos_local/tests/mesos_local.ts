import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MesosLocal } from "../target/types/mesos_local";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("mesos_local", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MesosLocal as Program<MesosLocal>;

  // Accounts
  const authority = provider.wallet.publicKey; // Provider wallet
  const user = anchor.web3.Keypair.generate();      // Client role
  const merchant = anchor.web3.Keypair.generate();  // Merchant role
  const anotherMerchant = anchor.web3.Keypair.generate(); // Another merchant for testing M->M block

  // Mints and PDAs
  let usdcMint: anchor.web3.PublicKey;
  let usdcMintKeypair: anchor.web3.Keypair;
  let vaultPda: anchor.web3.PublicKey;
  let vaultBump: number;
  let voucherMintPda: anchor.web3.PublicKey;
  let voucherMintBump: number;

  // Role PDAs
  let userRolePda: anchor.web3.PublicKey;
  let merchantRolePda: anchor.web3.PublicKey;
  let anotherMerchantRolePda: anchor.web3.PublicKey;

  // Token Accounts
  let userUsdc: anchor.web3.PublicKey;
  let userVoucher: anchor.web3.PublicKey;
  let merchantVoucher: anchor.web3.PublicKey;
  let anotherMerchantVoucher: anchor.web3.PublicKey;
  let vaultUsdc: anchor.web3.PublicKey;

  before(async () => {
    // Fund users with SOL
    const latestBlockHash = await provider.connection.getLatestBlockhash();

    const airdropUser = await provider.connection.requestAirdrop(user.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropUser
    });

    const airdropMerchant = await provider.connection.requestAirdrop(merchant.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropMerchant
    });

    const airdropAnother = await provider.connection.requestAirdrop(anotherMerchant.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropAnother
    });

    // Create Mock USDC Mint
    usdcMintKeypair = anchor.web3.Keypair.generate();
    usdcMint = await createMint(
      provider.connection,
      user, // payer
      user.publicKey, // mint authority
      null, // freeze authority
      6, // decimals
      usdcMintKeypair // keypair
    );

    // Derive PDAs
    [vaultPda, vaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), authority.toBuffer()],
      program.programId
    );

    [voucherMintPda, voucherMintBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("voucher_mint"), vaultPda.toBuffer()],
      program.programId
    );

    // Derive Role PDAs
    [userRolePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), vaultPda.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    [merchantRolePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), vaultPda.toBuffer(), merchant.publicKey.toBuffer()],
      program.programId
    );

    [anotherMerchantRolePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), vaultPda.toBuffer(), anotherMerchant.publicKey.toBuffer()],
      program.programId
    );

    // Create User USDC ATA
    const { createAssociatedTokenAccount } = require("@solana/spl-token");
    userUsdc = await createAssociatedTokenAccount(provider.connection, user, usdcMint, user.publicKey);

    // Derive Vault USDC ATA
    vaultUsdc = await getAssociatedTokenAddress(
      usdcMint,
      vaultPda,
      true // allowOwnerOffCurve
    );

    // Derive PLN ATAs
    userVoucher = await getAssociatedTokenAddress(voucherMintPda, user.publicKey);
    merchantVoucher = await getAssociatedTokenAddress(voucherMintPda, merchant.publicKey);
    anotherMerchantVoucher = await getAssociatedTokenAddress(voucherMintPda, anotherMerchant.publicKey);
  });

  it("Initializes the vault", async () => {
    await program.methods
      .initializeVault()
      .accountsStrict({
        vault: vaultPda,
        voucherMint: voucherMintPda,
        usdcMint: usdcMint,
        authority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const vaultAccount = await program.account.vault.fetch(vaultPda);
    assert.ok(vaultAccount.authority.equals(authority));
  });

  it("Registers user as Client", async () => {
    await program.methods
      .addClient(user.publicKey)
      .accountsStrict({
        vault: vaultPda,
        roleEntry: userRolePda,
        authority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const roleEntry = await program.account.roleEntry.fetch(userRolePda);
    assert.ok(roleEntry.address.equals(user.publicKey));
    assert.deepEqual(roleEntry.role, { client: {} });
    assert.ok(roleEntry.isActive);
  });

  it("Registers merchant as Merchant", async () => {
    await program.methods
      .addMerchant(merchant.publicKey)
      .accountsStrict({
        vault: vaultPda,
        roleEntry: merchantRolePda,
        authority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const roleEntry = await program.account.roleEntry.fetch(merchantRolePda);
    assert.ok(roleEntry.address.equals(merchant.publicKey));
    assert.deepEqual(roleEntry.role, { merchant: {} });
    assert.ok(roleEntry.isActive);
  });

  it("Deposits USDC and mints vouchers", async () => {
    // 1. Mint 100 USDC to user
    const amount = 100 * 1_000_000;
    await mintTo(
      provider.connection,
      user,
      usdcMint,
      userUsdc,
      user,
      amount
    );

    // 2. Deposit 10 USDC
    const depositAmount = new anchor.BN(10 * 1_000_000);

    await program.methods
      .depositUsdc(depositAmount)
      .accountsStrict({
        vault: vaultPda,
        voucherMint: voucherMintPda,
        usdcMint: usdcMint,
        user: user.publicKey,
        userUsdcAccount: userUsdc,
        userVoucherAccount: userVoucher,
        vaultUsdcAccount: vaultUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    // 3. Verify balances
    const userVoucherAcc = await getAccount(provider.connection, userVoucher);
    const expectedPln = 40 * 1_000_000; // 1:4 rate
    assert.equal(Number(userVoucherAcc.amount), expectedPln);
  });

  it("Transfers vouchers from Client to Merchant (Success)", async () => {
    const transferAmount = new anchor.BN(5 * 1_000_000);

    await program.methods
      .transferPln(transferAmount)
      .accountsStrict({
        vault: vaultPda,
        voucherMint: voucherMintPda,
        senderRole: userRolePda,      // Client role
        recipientRole: merchantRolePda, // Merchant role
        sender: user.publicKey,
        recipient: merchant.publicKey,
        senderVoucherAccount: userVoucher,
        recipientVoucherAccount: merchantVoucher,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([user])
      .rpc();

    const merchantVoucherAcc = await getAccount(provider.connection, merchantVoucher);
    assert.equal(Number(merchantVoucherAcc.amount), 5 * 1_000_000);
  });

  it("Blocks Merchant to Merchant transfer", async () => {
    // First register another merchant
    await program.methods
      .addMerchant(anotherMerchant.publicKey)
      .accountsStrict({
        vault: vaultPda,
        roleEntry: anotherMerchantRolePda,
        authority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const transferAmount = new anchor.BN(1 * 1_000_000);

    try {
      await program.methods
        .transferPln(transferAmount)
        .accountsStrict({
          vault: vaultPda,
          voucherMint: voucherMintPda,
          senderRole: merchantRolePda,        // Merchant trying to send
          recipientRole: anotherMerchantRolePda, // To another merchant
          sender: merchant.publicKey,
          recipient: anotherMerchant.publicKey,
          senderVoucherAccount: merchantVoucher,
          recipientVoucherAccount: anotherMerchantVoucher,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([merchant])
        .rpc();
      assert.fail("Should have failed - merchants cannot send");
    } catch (e: any) {
      // Should fail with OnlyClientCanSend
      assert.ok(e.message.includes("OnlyClientCanSend") || e.message.includes("6003"));
    }
  });

  it("Blocks transfer to non-registered address", async () => {
    const unregisteredUser = anchor.web3.Keypair.generate();
    const [unregisteredRolePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("role"), vaultPda.toBuffer(), unregisteredUser.publicKey.toBuffer()],
      program.programId
    );

    const transferAmount = new anchor.BN(1 * 1_000_000);

    try {
      await program.methods
        .transferPln(transferAmount)
        .accountsStrict({
          vault: vaultPda,
          voucherMint: voucherMintPda,
          senderRole: userRolePda,
          recipientRole: unregisteredRolePda, // Not initialized
          sender: user.publicKey,
          recipient: unregisteredUser.publicKey,
          senderVoucherAccount: userVoucher,
          recipientVoucherAccount: await getAssociatedTokenAddress(voucherMintPda, unregisteredUser.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      assert.fail("Should have failed - recipient not registered");
    } catch (e: any) {
      assert.ok(e.message.includes("AccountNotInitialized"));
    }
  });

  it("Settles vouchers (Burn -> Receive USDC)", async () => {
    const burnAmount = new anchor.BN(4 * 1_000_000);

    const merchantUsdcAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      merchant,
      usdcMint,
      merchant.publicKey
    );
    const merchantUsdc = merchantUsdcAccount.address;

    await program.methods
      .settle(burnAmount)
      .accountsStrict({
        vault: vaultPda,
        voucherMint: voucherMintPda,
        usdcMint: usdcMint,
        merchantRole: merchantRolePda,
        merchant: merchant.publicKey,
        merchantVoucherAccount: merchantVoucher,
        merchantUsdcAccount: merchantUsdc,
        vaultUsdcAccount: vaultUsdc,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([merchant])
      .rpc();

    // Verify balances
    const merchantUsdcAcc = await getAccount(provider.connection, merchantUsdc);
    assert.equal(Number(merchantUsdcAcc.amount), 1 * 1_000_000); // 1 USDC received

    const merchantVoucherAcc = await getAccount(provider.connection, merchantVoucher);
    assert.equal(Number(merchantVoucherAcc.amount), 1 * 1_000_000); // 5 - 4 = 1 vouchers remaining
  });
});
