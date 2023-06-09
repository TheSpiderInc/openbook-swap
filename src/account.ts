import { Market } from "@project-serum/serum";
import { MarketDetails } from "./market";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { getOrCreateTokenAccount } from "./token-account";
import { NATIVE_MINT } from "@solana/spl-token";

export const getAccountDetail = async (
    marketDetails: MarketDetails, 
    market: Market, 
    transaction: Transaction, 
    owner: PublicKey,
    connection: Connection, 
    lamports: number = 0): Promise<AccountDetails | null> => {
    try {
      const accountDetails: AccountDetails = {...initialAccountDetails};
  
      const baseTokenAccount = await getOrCreateTokenAccount(owner, marketDetails.base.mint, transaction, connection, lamports);
      if (baseTokenAccount && (baseTokenAccount as Keypair)?.publicKey) {
        accountDetails.baseTokenAccount = (baseTokenAccount as Keypair).publicKey;
        accountDetails.signers ? accountDetails.signers.push(baseTokenAccount as Keypair) : accountDetails.signers = [baseTokenAccount as Keypair];
      } else {
        if (!baseTokenAccount) {
          console.log('Could not get or create base token account.');
          return null;
        }
        accountDetails.baseTokenAccount = baseTokenAccount as PublicKey;
      }
      const quoteTokenAccount = await getOrCreateTokenAccount(owner, marketDetails.quote.mint, transaction, connection, lamports);
      if (quoteTokenAccount && (quoteTokenAccount as Keypair)?.publicKey) {
        accountDetails.quoteTokenAccount = (quoteTokenAccount as Keypair).publicKey;
        accountDetails.signers ? accountDetails.signers.push(quoteTokenAccount as Keypair) : accountDetails.signers = [quoteTokenAccount as Keypair];
      } else {
        if (!quoteTokenAccount) {
          console.log('Could not get or create quote token account.');
          return null;
        }
        accountDetails.quoteTokenAccount = quoteTokenAccount as PublicKey;
      }
      
      accountDetails.openOrders = await getOpenOrderAccount(market, owner, connection);
    
      return accountDetails;
    } catch (error) {
      console.log(error);
      return null;
    }
}

export const getOpenOrderAccount = async (market: Market, owner: PublicKey, connection: Connection): Promise<Keypair | PublicKey | undefined> => {
  try {
    let openOrdersAccounts = await market.findOpenOrdersAccountsForOwner(connection, owner);
    
    if (openOrdersAccounts && openOrdersAccounts.filter(oo => oo.market.toString() == market.address.toString()).length == 1) {
      return openOrdersAccounts.filter(oo => oo.market.toString() == market.address.toString())[0].address;
    } else {
      // TODO: SEE IF THAT CAN BE THE CASE
      if (openOrdersAccounts.filter(oo => oo.market.toString() == market.address.toString()).length > 1) {
        console.log('Weird, possible to have multiple Open Orders accounts?');
      } else {
        const openOrdersAccount = new Keypair();
        return openOrdersAccount;
      }
    }
  } catch (error) {
    console.log(error);
    return undefined;
  }
}

const getSolBalance = async (owner: PublicKey, connection: Connection) => {
  try {
      return (await connection.getBalance(owner)) / LAMPORTS_PER_SOL;
  } catch (error) {
      throw(error);
  }
}

const getSplTokenBalance = async (owner: PublicKey, mint: PublicKey, connection: Connection) => {
  const splTokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });

  return splTokenAccounts.value.length > 0 ? splTokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount : 0;
}

export const getWalletToken = async (owner: PublicKey, marketDetails: MarketDetails, connection: Connection): Promise<WalletDetails> => {
  const nativeMint = NATIVE_MINT.toString();
  const baseMint = marketDetails.base.mint.toString();
  const quoteMint = marketDetails.quote.mint.toString();

  return {
      amountBaseToken: baseMint == nativeMint ? await getSolBalance(owner, connection) : await getSplTokenBalance(owner, marketDetails.base.mint, connection),
      amountQuoteToken: quoteMint == nativeMint ? await getSolBalance(owner, connection) : await getSplTokenBalance(owner, marketDetails.quote.mint, connection)
  }
  
}

export interface AccountDetails {
    baseTokenAccount?: PublicKey;
    quoteTokenAccount?: PublicKey;
    openOrders?: Keypair | PublicKey;
    signers?: Keypair[];
}

export const initialAccountDetails: AccountDetails = {
    baseTokenAccount: undefined,
    openOrders: undefined,
    quoteTokenAccount: undefined,
    signers: undefined
}

export interface WalletDetails {
  amountBaseToken: number;
  amountQuoteToken: number;
}