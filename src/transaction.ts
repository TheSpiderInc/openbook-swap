import { Connection, ParsedTransactionWithMeta, PublicKey } from "@solana/web3.js";
import { MarketDetails } from "./market";
import { SwapTransactionResult } from "./swap";
import { waitFor } from "./helper";
import { getDifferenceByToken } from "./balance";

export const confirmTransaction = async (connection: Connection, signature: string, owner: PublicKey, marketDetails: MarketDetails): Promise<SwapTransactionResult> => {
    try {
        let transactionDetails: ParsedTransactionWithMeta | null = null;
    
        while (transactionDetails == null) {
            transactionDetails = await connection.getParsedTransaction(signature, { commitment: "confirmed" });
            await waitFor(1000);
        }
    
        if (transactionDetails?.meta?.err) {
            return {error: true, message: transactionDetails?.meta?.err?.toString()};
        }

        const balancesDifference = getDifferenceByToken([marketDetails.base.mint.toString(), marketDetails.quote.mint.toString()], transactionDetails, owner.toString());
    
        return {balances: balancesDifference};
    } catch (error: any) {
        return {error: true, message: error.toString()};
    }
}