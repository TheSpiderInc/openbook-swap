import { NATIVE_MINT } from "@solana/spl-token";
import { ParsedTransactionWithMeta } from "@solana/web3.js";

export const getDifferenceByToken = (tokens: string[], transaction: ParsedTransactionWithMeta, owner: string) => {
    const balanceDifference: {[key: string] : number} = {};

    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] == NATIVE_MINT.toString()) {
            const postSol = (transaction.meta?.postBalances[0] ?? 0) * 0.000000001;
            const preSol = (transaction.meta?.preBalances[0] ?? 0) * 0.000000001;
            balanceDifference[tokens[i]] = postSol - preSol;
        } else {
            const preBalance = transaction.meta?.preTokenBalances?.find((ptb) => ptb.mint == tokens[i] && ptb.owner == owner)?.uiTokenAmount.uiAmount;
            const postBalance = transaction.meta?.postTokenBalances?.find((ptb) => ptb.mint == tokens[i] && ptb.owner == owner)?.uiTokenAmount.uiAmount;
    
            // IF TOKEN ACCOUNT DIDNT EXISTED BEFORE OR GOT DELETED
            if ((preBalance == undefined || preBalance == null) && (postBalance != undefined && postBalance != null)) {
                balanceDifference[tokens[i]] = postBalance;
            } else if ((postBalance == undefined || postBalance == null) && (preBalance != undefined && preBalance != null)) {
                balanceDifference[tokens[i]] = -preBalance;
            } else if (preBalance != undefined && preBalance != null && postBalance != undefined && postBalance != null) {
                balanceDifference[tokens[i]] = postBalance - preBalance;
            }
        }
    }

    return balanceDifference;
}