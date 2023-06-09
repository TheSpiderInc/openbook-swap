import { PublicKey } from "@solana/web3.js";
import axios from "axios";
import { API_BASE_URL } from "./constants/api.constant";

export const geTokenPrices= async (tokens: string[]): Promise<{ data: {tokenPrices: {[key: string]: number}}} | null> => {
    try {
      return axios({
        url: `${API_BASE_URL}markets/get-token-prices`,
        method: "post",
        headers: { "Content-Type": "application/json" },
        data: {tokens: tokens}
      });
    } catch (error) {
      console.log(error)
      return null;
    }
  }

export interface Tokens {
    [key: string]: TokenAddressesDetails
}

export interface TokenAddressesDetails {
    name: string;
    logo: string;
    mint: PublicKey; 
    price: number;   
}

export interface TokenDetails {
    name: string;
    logo: string;
    mint: PublicKey;
    vault: PublicKey;
}