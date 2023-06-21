import { Connection, PublicKey } from "@solana/web3.js";
import { TokenDetails } from "./token";
import { DEX_ADDRESS } from "./constants/dex.constant";
import { API_BASE_URL } from "./constants/api.constant";
import { Swap } from "./swap";
import { Market, Orderbook } from "./serum/market";

export const getMarketOrdersOnChain = async (marketAddress: PublicKey, connection: Connection, market?: Market) : Promise<{market: MarketOrders | undefined} | undefined> => {
    try {
        if (!market) {
            const programAddress = new PublicKey(DEX_ADDRESS);
            market = await Market.load(connection, marketAddress, {}, programAddress);
        }
        return {market: await getMarketInfo(connection, market)};
    } catch (error) {
        throw(error);
    }
}
  
export const getMarketInfo = async (connection: Connection, market: Market) : Promise<MarketOrders | undefined> => {
    try {
        const [bids, asks] = await Promise.all([
            market.loadBids(connection),
            market.loadAsks(connection)
        ]);

        const bidsL2 = ((bids as Orderbook).getL2(Number.MAX_VALUE) as number[][]).map((value) => [value[0], value[1]]);
        const asksL2 = ((asks as Orderbook).getL2(Number.MAX_VALUE) as number[][]).map((value) => [value[0], value[1]]);

        const marketInfo: MarketOrders = {
            bids: bidsL2,
            asks: asksL2,
            totalBaseQuantity: asksL2.reduce((accum, current) => accum + current[1], 0),
            totalQuoteQuantity: bidsL2.reduce((accum, current) => accum + (current[1] * current[0]), 0),
            highestBid: bidsL2[0][0],
            highestBidVQuantity: bidsL2[0][1],
            lowestAsk: asksL2[0][0],
            lowestAskQuantity: asksL2[0][1],
            updatedAt: new Date().toLocaleTimeString()
        }
        
        return marketInfo;
    } catch (error) {
        throw(error);
    }
}

export const getMarket = async (marketAddress: string): Promise<{data: {market: MarketOrders, tokenPrices: {[key: string]: number}}} | null> => {
    try {
        return {
            data: await (
                await fetch(`${API_BASE_URL}markets/info?address=${marketAddress}`, 
                { headers: {"Content-Type": "application/json"} })).json() };
    } catch (error) {
      console.log(error)
      return null;
    }
  }
  
  export const getMarketOrders = async (marketAddress: PublicKey) : Promise<{market: MarketOrders, tokenPrices: {[key: string]: number}} | null> => {
    try {
      return await (await getMarket(marketAddress.toString()))?.data ?? null;
    } catch (error) {
      console.log(error);
      return null;
    }
}

export const getMarketData = async (marketAddress: PublicKey, connection: Connection, onchain: boolean): Promise<{marketOrdersResponse: any, isOnChainData: boolean}> => {
    let marketOrdersResponse: any;
    let isOnChainData = false;
  
    if (onchain) {
        marketOrdersResponse = await getMarketOrdersOnChain(marketAddress, connection);
    } else {
        marketOrdersResponse = await getMarketOrders(marketAddress);
        if (!marketOrdersResponse) {
            isOnChainData = true;
        } else if (isOnChainData) {
            isOnChainData = false;
        }
    }
  
    return {
      marketOrdersResponse,
      isOnChainData
    }
}

export const computeQuotes = async (marketOrders: MarketOrders, swap: Swap) => {
    try {
        if(!marketOrders?.bids || !marketOrders?.asks) return
        
        const baseAmount = parseFloat(swap.inputAmounts.base) ?? 0;
        const quoteAmount = parseFloat(swap.inputAmounts.quote) ?? 0;
  
        if(swap.sell && baseAmount > 0) {
            let amount = baseAmount;
            let value = 0;
            let bidIndex = 0;
            let totalVolume = 0;
            while (amount > 0 && bidIndex < marketOrders.bids.length) {
                const cost = (amount > marketOrders.bids[bidIndex][1] ? marketOrders.bids[bidIndex][1] : amount) * marketOrders.bids[bidIndex][0];
                value += cost;
                amount -= marketOrders.bids[bidIndex][1];
                totalVolume += marketOrders.bids[bidIndex][1];
                bidIndex++;
            }
            if (amount > 0) {
              console.log('Market empty, max', totalVolume.toLocaleString(), swap.market.base.name);
          }
            return {...swap, 
                amounts: {
                    ...swap.amounts, 
                    quote: marketOrders.totalQuoteQuantity < value ? marketOrders.totalQuoteQuantity * (1 - swap.market.swapMargin) : value * (1 - swap.market.swapMargin)
                },
                inputAmounts: {
                    ...swap.inputAmounts,
                    base: amount > 0 ? totalVolume.toFixed(2) : swap.inputAmounts.base
                },
                slotConsumed: bidIndex
            };
        } else if (!swap.sell && quoteAmount > 0) {
            let amount = quoteAmount;
            let value = 0;
            let quoteIndex = 0;
            let totalCost = 0;
            while (amount > 0 && quoteIndex < marketOrders.asks.length) {
                // TODO: WHAT IS THE COST OF THE "ORDER STEP" ?
                const cost = marketOrders.asks[quoteIndex][1] * marketOrders.asks[quoteIndex][0];
                value += amount > cost ? marketOrders.asks[quoteIndex][1] : (amount/cost) * marketOrders.asks[quoteIndex][1];
                amount -= cost;
                totalCost += cost;
                quoteIndex++;
            }
            if (amount > 0) {
                console.log('Market empty, max', totalCost.toLocaleString(), swap.market.quote.name);
            }
            const newBase = Math.round((value * (1 - swap.market.swapMargin)) / 1000) * 1000;
            return {...swap, 
                amounts: {
                    ...swap.amounts, 
                    base: marketOrders.totalBaseQuantity < newBase ? marketOrders.totalBaseQuantity : newBase,
                },
                inputAmounts: {
                    ...swap.inputAmounts,
                    quote: amount > 0 ? totalCost.toFixed(2) : swap.inputAmounts.quote
                },
                slotConsumed: quoteIndex
            };
        } else {
            if (swap.sell) {
                return {...swap, amounts: {...swap.amounts, quote: 0},
                    inputAmounts: {...swap.inputAmounts, quote: ""}};
            } else {
                return {...swap, amounts: {...swap.amounts, base: 0},
                    inputAmounts: {...swap.inputAmounts, base: ""}};
            }
        }
    } catch (error) {
        console.log(error);
        return undefined;
    }   
}

export const updateMarketOrders = async (marketOrders: MarketOrders, marketOrdersResponse: any, setMarketOrders: (value: MarketOrders) => void, base: string, price: number) => {
    const bidDifference = Number(((Number(marketOrders?.highestBid) - Number(marketOrdersResponse?.market?.highestBid)) / Number(marketOrders?.highestBid)));
    const askDifference = Number(((Number(marketOrdersResponse?.market?.lowestAsk) - Number(marketOrders?.lowestAsk)) / Number(marketOrders?.lowestAsk)));
    let updateBids = false;
    let updateAsks = false;
    if (marketOrdersResponse != null && (marketOrders.asks.length == 0 || marketOrders.bids.length == 0) && marketOrdersResponse.market) {
        setMarketOrders(marketOrdersResponse.market);
        return;
    }
    if (marketOrdersResponse == null) {
        return;
    }

    const valueBase = Number(marketOrdersResponse?.market?.highestBid) * price;
    const valueQuote = Number(marketOrdersResponse?.market?.lowestAsk) * price;

    if ((bidDifference != 0 || Number(marketOrders?.highestBid) == 0) && ((valueQuote - valueBase) / valueQuote) < 0.1) {
        updateBids = true;
    }
    if ((askDifference != 0 || Number(marketOrders?.lowestAsk) == 0) && ((valueQuote - valueBase) / valueQuote) < 0.1) {
        updateAsks = true;
    }

    if (updateAsks && updateBids && marketOrdersResponse.market) {
        setMarketOrders(marketOrdersResponse.market);
        return;
    } else if (updateAsks && marketOrdersResponse?.market?.lowestAsk ) {
        if (marketOrders != undefined && marketOrdersResponse?.market?.lowestAsk > 0) {
            setMarketOrders({
                ...marketOrders,
                asks: marketOrdersResponse?.market?.asks ?? [],
                lowestAsk: marketOrdersResponse?.market?.lowestAsk,
                lowestAskQuantity: marketOrdersResponse.market?.lowestAskQuantity,
                totalBaseQuantity: marketOrdersResponse.market?.totalBaseQuantity,
                totalQuoteQuantity: marketOrdersResponse.market?.totalQuoteQuantity
            });
        }
    } else if (updateBids && marketOrdersResponse?.market?.highestBid) {
        if (marketOrders != undefined && marketOrdersResponse?.market?.highestBid > 0) {
            setMarketOrders({
                ...marketOrders,
                bids: marketOrdersResponse?.market?.bids ?? [],
                highestBid: marketOrdersResponse?.market?.highestBid ?? 0,
                highestBidVQuantity: marketOrdersResponse.market?.highestBidVQuantity ?? 0,
                totalBaseQuantity: marketOrdersResponse.market?.totalBaseQuantity ?? 0,
                totalQuoteQuantity: marketOrdersResponse.market?.totalQuoteQuantity ?? 0
            });
        }
    }
}

export const marketOrdersInit: MarketOrders = {
    bids: [],
    asks: [],
    totalBaseQuantity: 0,
    totalQuoteQuantity: 0,
    highestBid: 0,
    lowestAsk: 0,
    highestBidVQuantity: 0,
    lowestAskQuantity: 0,
    updatedAt: ''
}

export interface Markets {
    [key: string]: MarketDetails
}

export interface MarketDetails {
    address: PublicKey;
    base: TokenDetails;
    quote: TokenDetails;
    minBase: number;
    swapMargin: number;
}

export interface MarketOrders {
    bids: number[][];
    asks: number[][];
    totalBaseQuantity: number;
    totalQuoteQuantity: number;
    highestBid: number,
    lowestAsk: number;
    highestBidVQuantity: number;
    lowestAskQuantity: number;
    updatedAt: string;
}

export interface SwapMarket {
    address: PublicKey;
    base: SwapMarketToken;
    quote: SwapMarketToken;
    minBase: number;
    swapMargin: number;
}

export interface SwapMarketToken {
    name: string;
    logo: string;
    mint: PublicKey;
    vault: PublicKey;
}