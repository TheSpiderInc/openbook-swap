import { encodeInstruction } from "@project-serum/serum/lib/instructions";
import { Market } from "@project-serum/serum/lib/market";
import { Account, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { DEX_ADDRESS } from "./constants/dex.constant";
import { MarketDetails, MarketOrders, getMarketOrders, getMarketOrdersOnChain } from "./market";
import { AccountDetails, getAccountDetail } from "./account";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, createCloseAccountInstruction } from "@solana/spl-token";
import BN from 'bn.js';

export const getCloseOpenOrdersInstruction = (openOrders: PublicKey, market: PublicKey, owner: PublicKey): TransactionInstruction | null => {
    // TODO: SHOULD WE LET THE USER CHOOSE THE PROGRAM ADDRESS?
    const programAddress = new PublicKey(DEX_ADDRESS);
    const keys = [
        { pubkey: openOrders, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: owner, isSigner: false, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: false },
    ];
    return new TransactionInstruction({
        keys,
        programId: programAddress,
        data: encodeInstruction({
            closeOpenOrders: {},
        }),
    });
}

export const getSwapTransaction = async (owner: PublicKey, side: Side, limit: number, size: number, marketDetails: MarketDetails, connection: Connection, apiKey: string | null = null): Promise<SwapTransaction | string> => {
    try {
        const transaction = new Transaction();
        const programAddress = new PublicKey(DEX_ADDRESS);
        const market = await Market.load(connection, marketDetails.address, {}, programAddress);
        let marketInfo: MarketOrders | null = null;

        // USING ONCHAIN DATA
        if (apiKey == null) {
            marketInfo = (await getMarketOrdersOnChain(market.address, connection))?.market ?? null;
            if (!marketInfo?.lowestAsk || !marketInfo.highestBid) {
                throw('Cannot get market information - please check your RPC and market address');
            }
        } 
        // USING API
        // TODO: FINISH THIS THING
        else {
          let getMarketOrdersResponse = await getMarketOrders(market.address);
          if (!getMarketOrdersResponse?.market)
            throw('Cannot get market information from API');
          marketInfo = getMarketOrdersResponse.market;
        }

        if (marketInfo === null) {
          throw('Cannot get market information');
        }
  
      // ALSO CHECK IF WALLET HAS ENOUGH FUNDS
      // SEE IF THIS 1.01 SLIPPAGE SHOULD BE VARIABLE
      let accountDetails = await getAccountDetail(marketDetails, market, transaction, owner, connection, side == Side.Buy ? limit * size * 1.01 * LAMPORTS_PER_SOL : 0);
          
      if (!accountDetails || !accountDetails.baseTokenAccount || !accountDetails.quoteTokenAccount) {
        return 'Cannot get account information';
      }
  
      // CHECK ALSO IF QUANTITY IS ENOUGH (FOR SOL SPECIFICALLY) BUT SHOULD BE DONE BEFORE IN THE UI
      // ADDING AN EXTRA 0.5% SO THE PHANTOM ORDER AS A LITTLE ROOM TO MOVE
      const margin = marketDetails.swapMargin + 0.005;
      if ((side == Side.Buy && (limit * 1.05) < marketInfo.lowestAsk) || (side == Side.Sell && (limit * 0.95) > marketInfo.highestBid)) {
        throw(`Oops quote changed, please refresh (old quote ${limit.toFixed(10)} and new quote ${side == Side.Buy ? marketInfo.lowestAsk.toFixed(10) : marketInfo.highestBid.toFixed(10)})`);
      } else {
        // MAKE THE CALCULATION MORE PRECISE
        const minimumReceive = +(side == Side.Buy ? +marketInfo.lowestAsk.toFixed(10) * (1 + margin) : +marketInfo.highestBid.toFixed(10) * (1 - margin)) * size;
        console.log('Going to process the order at rate', side == Side.Buy ? marketInfo.lowestAsk.toFixed(10) : marketInfo.highestBid.toFixed(10), '. Should pay/receive max/min', minimumReceive.toFixed(10), 'qty', size);
      }
  
      const orderTransaction = await getOrderTransaction(market, side, side == Side.Buy ? marketInfo.lowestAsk * (1 + margin) : marketInfo.highestBid * (1 - margin), size, accountDetails, owner, margin, connection);
  
      if (!orderTransaction) {
          throw('Cannot create order instruction');
      }
  
      transaction.add(orderTransaction.transaction);
  
      const settleIx = getSettleInstruction(market, marketDetails, accountDetails, owner);
          
      if (!settleIx) {
        throw('Cannot create settle instruction');
      }
      
      transaction.add(settleIx);
  
      if (marketDetails.base.mint.toString() == NATIVE_MINT.toString()) {
        const closeAccountInstruction = createCloseAccountInstruction(accountDetails.baseTokenAccount, owner, owner);
        transaction.add(closeAccountInstruction);
      } else if (marketDetails.quote.mint.toString() == NATIVE_MINT.toString()) {
        const closeAccountInstruction = createCloseAccountInstruction(accountDetails.quoteTokenAccount, owner, owner);
        transaction.add(closeAccountInstruction);
      }
  
      return {
        signers: (accountDetails.signers ? accountDetails.signers : []).concat(accountDetails.openOrders && accountDetails.openOrders.hasOwnProperty('_keypair') ? [accountDetails.openOrders as Keypair] : []),
        transaction: transaction,
        isNewOpenOrders: (accountDetails.openOrders && accountDetails.openOrders.hasOwnProperty('_keypair')) ?? false
      }
  
    } catch (error: any) {
      console.log(error);
      return error.toString();
    }
}

const getOrderTransaction = async (market: Market, side: Side, price: number, size: number, accountDetails: AccountDetails, owner: PublicKey, swapMargin: number, connection: Connection): Promise<{transaction: Transaction} | null> => {
    try {
      if (!accountDetails.quoteTokenAccount || !accountDetails.baseTokenAccount) {
          return null;
      }

      const programAddress = new PublicKey(DEX_ADDRESS);
    
      // TODO: WHY NOT USING THIS ONE: makeMatchOrdersTransaction ? Maybe the response to the partial fill
      // CHECK DIFFERENCE WITH THIS ONE: makeNewOrderV3Instruction
      if (accountDetails.openOrders?.hasOwnProperty('_keypair')) {
        return await market.makePlaceOrderTransaction(connection,
            {
                owner: owner,
                payer: side == Side.Buy ? accountDetails.quoteTokenAccount: accountDetails.baseTokenAccount,
                price: price * (side == Side.Buy ? (1 + swapMargin) : (1 - swapMargin)),
                side,
                size,
                orderType: 'ioc',
                selfTradeBehavior: "decrementTake",
                openOrdersAccount: new Account((accountDetails.openOrders as Keypair).secretKey),
                openOrdersAddressKey: (accountDetails.openOrders as Keypair).publicKey,
                programId: programAddress
            });
      } else {
        return await market.makePlaceOrderTransaction(connection,
          {
              owner: owner,
              payer: side == Side.Buy ? accountDetails.quoteTokenAccount: accountDetails.baseTokenAccount,
              price: price * (side == Side.Buy ? (1 + swapMargin) : (1 - swapMargin)),
              side,
              size,
              orderType: 'ioc',
              selfTradeBehavior: "decrementTake", 
              programId: programAddress
          });
      }
    } catch (error) {
      console.log(error);
      return null;
    }
}

const getSettleInstruction = (market: Market, marketDetails: MarketDetails, accountDetails: AccountDetails, owner: PublicKey): TransactionInstruction | null => {
  try {
    if (!accountDetails.openOrders || !accountDetails.baseTokenAccount || !accountDetails.quoteTokenAccount) {
        return null;
    }
  
    const programAddress = new PublicKey(DEX_ADDRESS);
    let vaultSigner;
  
    // SHOULD WE MANUALLY PUT THE VAULT SIGNER IN THE CONST? 
    // OR FIND A WAY TO AUTO FIND THEM
    // MARKET INFO?
    if (marketDetails.quote.mint.toString() === NATIVE_MINT.toString()) {
      vaultSigner = new PublicKey('51Cdt3oASXuVD88tAqJEeR6XH3PjQQ3xb7Cd22KaW2GK');
    } else {
      vaultSigner = PublicKey.createProgramAddressSync(
        [
          market.address.toBuffer(),
          new BN(1).toArrayLike(Buffer, 'le', 8), // ?? Might be when no PDAs
        ],
        programAddress,
      );
    }
    
    const keys = [
        { pubkey: market.address, isSigner: false, isWritable: true },
        { pubkey: accountDetails.openOrders.hasOwnProperty('_keypair') ? (accountDetails.openOrders as Keypair).publicKey : accountDetails.openOrders as PublicKey, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
        { pubkey: marketDetails.base.vault, isSigner: false, isWritable: true },
        { pubkey: marketDetails.quote.vault, isSigner: false, isWritable: true },
        { pubkey: accountDetails.baseTokenAccount, isSigner: false, isWritable: true },
        { pubkey: accountDetails.quoteTokenAccount, isSigner: false, isWritable: true },
        { pubkey: vaultSigner, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];
    
    return new TransactionInstruction({
        keys,
        programId: programAddress,
        data: encodeInstruction({
          settleFunds: {},
        }),
      });
  } catch (error) {
    return null;
  }
}

export const newSwap = async (owner: PublicKey, swap: Swap, lowestAsk: number, highestBid: number, connection: Connection, apiKey: string | null = null): Promise<SwapDetail> => {
  try {
    const baseAmount = parseFloat(swap.inputAmounts.base) ?? 0;
    const quoteAmount = parseFloat(swap.inputAmounts.quote) ?? 0;

    if (swap.sell ? baseAmount == 0 : quoteAmount == 0) {
      return {error: `Amount incorrect`};
    }
    if (swap.sell ? baseAmount < swap.market.minBase : swap.amounts.base < swap.market.minBase) {
      return {error: `Must swap at least ${swap.market.minBase} ${swap.market.base.name}`};
    }
    if (!lowestAsk || !highestBid) {
      return {error: `Error getting market data`};
    }

    const limit = swap.sell ? highestBid * (1 - swap.market.swapMargin) : lowestAsk * (1 + swap.market.swapMargin);
    const size = swap.sell ? baseAmount : swap.amounts.base;
    const side = swap.sell ? Side.Sell : Side.Buy;
    
    const swapTransaction = await getSwapTransaction(owner, side, limit, size, swap.market, connection, apiKey);
    if (typeof swapTransaction == 'string') {
      return {error: `Swap error, ${swapTransaction}`};
    } else {
      return {transaction: swapTransaction};
    }
    
  } catch (error) {
    return {error: `Swap error ${error}`};
  }
}

export interface Swap {
    sell: boolean; 
    market: MarketDetails,
    amounts: SwapAmounts,
    inputAmounts: InputAmounts,
    slotConsumed: number,
}

export interface InputAmounts {
    base: string;
    quote: string;
}

export interface SwapAmounts {
    base: number;
    quote: number;
}

export enum Side {
    Buy = 'buy',
    Sell = 'sell'
}

export interface SwapTransaction {
    transaction: Transaction;
    signers: Keypair[];
    isNewOpenOrders: boolean;
}

export interface SwapDetail {
  message?: string;
  error?: string;
  transaction?: SwapTransaction;
  market?: MarketDetails;
}

export interface SwapTransactionResult {
  error?: boolean;
  message?: string;
  balances?: {[key: string]: number}
}