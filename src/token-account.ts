import { initializeAccount } from "@project-serum/serum/lib/token-instructions";
import { ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export const getOrCreateTokenAccount = async (
    owner: PublicKey, 
    mint: PublicKey, 
    transaction: Transaction, 
    connection: Connection,
    lamports: number = 0
): Promise<Keypair | PublicKey | undefined> => {
    try {
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        {
          mint
        }
      );
  
      if (mint.toString() === NATIVE_MINT.toString()) {
        const wrappedSolAccount = new Keypair();
        lamports = Math.max(lamports, 0) + 1e7;
        transaction.add(
          SystemProgram.createAccount({
            fromPubkey: owner,
            newAccountPubkey: wrappedSolAccount.publicKey,
            lamports: lamports,
            space: 165,
            programId: TOKEN_PROGRAM_ID,
          }),
        );
        transaction.add(
          initializeAccount({
            account: wrappedSolAccount.publicKey,
            mint: NATIVE_MINT,
            owner: owner,
          }),
        );
        return wrappedSolAccount;
      }
    
      if (tokenAccounts.value && tokenAccounts.value.length > 0 && 
        tokenAccounts.value.length === 1) {
          return tokenAccounts.value[0].pubkey;
        } else if (tokenAccounts.value.length == 0) {
          const newTokenAccount = await getAssociatedTokenAddress(mint, owner);
          transaction.add(createAssociatedTokenAccountInstruction(
            owner,
            newTokenAccount,
            owner,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
            ));
            return newTokenAccount;
          } else {
          // TODO: SEE IF MULTIPLE TOKEN ACCOUNTS
          console.log('Multiple token account for base mint')
      }
    
      return undefined;
    } catch (error) {
      console.log(error);
      return undefined;
    }
}

export const getAssociatedTokenAddress = async (
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): Promise<PublicKey> => {
    if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) throw new Error('TokenOwnerOffCurveError')

    const [address, number] = PublicKey.findProgramAddressSync(
        [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
        associatedTokenProgramId
    )

    return address
}