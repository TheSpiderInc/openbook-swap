import { useEffect, useMemo, useState } from "react";
import { Swap, SwapDetail, SwapTransactionResult, newSwap } from "./swap";
import { WalletDetails, getWalletToken } from "./account";
import { MarketDetails, MarketOrders, SwapMarket, computeQuotes, getMarketData, marketOrdersInit, updateMarketOrders } from "./market";
import { confirmTransaction } from "./transaction";
import { Connection, PublicKey } from "@solana/web3.js";
import debounce from 'lodash.debounce';
import React from "react";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { geTokenPrices } from "./token";
import { TokenInput } from "./token-input";
import { TokenQuote } from "./token-quote";
import swapImage from '@thespidercode/openbook-swap/src/images/icons/icon-swap.svg';
import '@thespidercode/openbook-swap/src/css/openbookswap.css';
import * as buffer from "buffer";
window.Buffer = buffer.Buffer;

export function SwapContainer(props: SwapContainerProps) {
    const { title, markets, connection, wallet, onSwapLoading, onSwapError, onSwapSuccess, onSwap, colors, manualTransaction } = props;

    const style = {
        "--primary-color": colors?.primary || "grey",
        "--secondary-color": colors?.secondary || "#3a3a3a",
        "--background-color": colors?.background || "rgb(27, 23, 23)",
        "--text-color": colors?.text || "#fff",
        "--button-color": colors?.swapButton || "grey"
    } as React.CSSProperties;

    const [swap, setSwap] = useState<Swap>({
        sell: false,
        market: markets[0], 
        amounts: {base: 0, quote: 0},
        inputAmounts: {base: "", quote: ""},
        slotConsumed: 0
    });

    const [userTokens, setUserTokens] = useState<WalletDetails>();
    const [marketOrders, setMarketOrders] = useState<MarketOrders>(marketOrdersInit);
    const [loadingSwap, setLoadingSwap] = useState(false);
    const [alertMessages, setAlertMessages] = useState<string[]>([]);
    const [priceAccuracy, setPriceAccuracy] = useState(0);
    const [counter, setCounter] = useState(0);

    const [prices, setPrices] = useState<{[key: string]: number}>({});

    let isOnChainData = false;
    let timeoutId : number | null = null;

    const processTransactionConfirmation = async (transactionConfirmation: SwapTransactionResult, orderSignature: string) => {
        if (transactionConfirmation.error) {
            onSwapError({message: transactionConfirmation.message ?? "", signature: orderSignature} as SwapError);
        }

        if (!transactionConfirmation.balances) {
            onSwapSuccess({
                message: "Swap successfull",
                signature: orderSignature,
                differences: {
                    base: transactionConfirmation.balances ? transactionConfirmation.balances[swap.market.base.mint.toString()] : null,
                    quote: transactionConfirmation.balances ? transactionConfirmation.balances[swap.market.quote.mint.toString()] : null
                } 
            } as SwapSuccess);
        } else if (transactionConfirmation.balances[swap.market.base.mint.toString()] == 0 && transactionConfirmation.balances[swap.market.quote.mint.toString()] == 0) {
            onSwapError({
                message: "Exceeded Slippage Boundary",
                signature: orderSignature,
            } as SwapError);
        } else {
            onSwapSuccess({
                message: "Swap successfull",
                signature: orderSignature,
                differences: {
                    base: transactionConfirmation.balances ? transactionConfirmation.balances[swap.market.base.mint.toString()] : null,
                    quote: transactionConfirmation.balances ? transactionConfirmation.balances[swap.market.quote.mint.toString()] : null
                } 
            } as SwapSuccess);
        }
    }

    const processOrder = async () => {
        setLoadingSwap(true);

        try {
            if (!(wallet && wallet.publicKey) && !manualTransaction) {
                onSwapError({message: "Cannot get wallet address"} as SwapError);
                return;
            }

            if (!marketOrders) {
                onSwapError({message: "Cannot get market information"} as SwapError);
                return;
            }

            const swapResult = await newSwap((wallet && wallet?.publicKey ? wallet.publicKey : new PublicKey((manualTransaction as any)?.toString())), swap, marketOrders.lowestAsk, marketOrders.highestBid, connection);

            if (swapResult.error || !swapResult.transaction) {
                onSwapError({
                    message: "Cannot get wallet and/or market information", 
                } as SwapError);
                setLoadingSwap(false);
                return;
            }

            if (manualTransaction && onSwap) {
                swapResult.market = swap.market;
                onSwap({
                    swapResult,
                    setLoadingSwap,
                    refreshUserBalances
                });
                return;
            }

            if (!wallet || !wallet.publicKey) {
                onSwapError({
                    message: "Cannot get wallet",
                } as SwapError);
                setLoadingSwap(false);
                return;
            }

            const orderSignature = await wallet.sendTransaction(swapResult.transaction.transaction, connection, { signers: swapResult.transaction.signers });
            onSwapLoading({
                message: "Waiting for the transaction to confirm...",
            } as SwapLoading);

            const latestBlockHash = await connection.getLatestBlockhash();
            const transactionConfirmation: SwapTransactionResult = await confirmTransaction(connection, orderSignature, wallet.publicKey, swap.market);

            await processTransactionConfirmation(transactionConfirmation, orderSignature);
            await connection.confirmTransaction({signature: orderSignature, blockhash: latestBlockHash.blockhash, lastValidBlockHeight: latestBlockHash.lastValidBlockHeight}, 'finalized');
            refreshUserBalances(wallet.publicKey as PublicKey);
        } catch (error: any) {
            if (error && (error.toString().includes('0x1') || error.toString().includes('0x22'))) {
                onSwapError({
                    message: "Insufficient funds.", 
                } as SwapError);
            } else {
                onSwapError({
                    message: error?.toString()?.replace('WalletSendTransactionError: ', ''), 
                } as SwapError);
            }
        }
        setLoadingSwap(false);
    }

    const refreshQuotes = async () => {
        try {
            if(!marketOrders?.bids || !marketOrders?.asks) return;

            const computedQuotes = await computeQuotes(marketOrders, swap);
            if (!computedQuotes) return;

            const inputAmount: number = swap.sell ? +computedQuotes.inputAmounts.base : +computedQuotes.inputAmounts.quote;
            const quoteAmount: number = swap.sell ? computedQuotes.amounts.quote : computedQuotes.amounts.base;
            if (inputAmount && quoteAmount) {
                const valueInput = inputAmount * (swap.sell ? prices[swap.market.base.name] : prices[swap.market.quote.name]);
                const valueQuote = quoteAmount * (swap.sell ? prices[swap.market.quote.name] : prices[swap.market.base.name]);
                setPriceAccuracy(((valueInput / valueQuote) * 100) - 100);
            }

            setSwap(computedQuotes);
        } catch (error) {
            console.log(error);
        }   
    }
    
    const switchPair = () => {
        setSwap({
            ...swap,
            sell: !swap.sell,
            inputAmounts: {
                ...swap.inputAmounts,
                base: (swap.sell ? swap.inputAmounts.base : (swap.amounts.base > 0 ? swap.amounts.base.toFixed(2) : '')),
                quote: (swap.sell ? (swap.amounts.quote > 0 ? swap.amounts.quote.toFixed(2) : '') : swap.inputAmounts.quote)
            }
        });
    }
    
    const refreshUserBalances = async (owner: PublicKey) => {
        try {
            const walletTokens = await getWalletToken(owner, swap.market, connection);
            setUserTokens(walletTokens);
        } catch (error) {
            setUserTokens(undefined);
        }
    }

    const refreshMarketOrders = async (onchain: boolean = false, marketAddress: PublicKey = swap.market.address) => {
        try {
            let marketOrdersResponse: any;

            if (onchain && !isOnChainData) return;
            const marketQuery = await getMarketData(marketAddress, connection, onchain);
            if (!marketQuery) return;

            marketOrdersResponse = marketQuery.marketOrdersResponse;

            const tokens = markets
                .map((market) => [market.base.name, market.quote.name])
                .flat()
                .filter((value, index, self) => {
                    // Only keep the first occurrence of each value
                    if (self.indexOf(value) !== index) {
                    return false;
                    }
                    // Ensure that the value is not undefined, null, or an empty string
                    return value != null && value.trim() !== '';
            });

            const tokenPrices: any = await geTokenPrices(tokens);

            var obj: any = {};
            for(var token of tokens) {
                obj[token] = tokenPrices.data.tokenPrices[token] ?? 0;
            }
            setPrices(obj);
            isOnChainData = marketQuery.isOnChainData;

            const priceAlertMessage = 'OpenBONK is experiencing a price delay that can impact swaps';
            if (Date.parse(marketOrdersResponse?.market['updatedAt']) + 3660000 < Date.now()) {
                if (!alertMessages.includes(priceAlertMessage)) {
                    const newAlerts = [...alertMessages, priceAlertMessage];
                    setAlertMessages(newAlerts);
                }
            } else {
                const newAlerts = [...alertMessages.filter(((am: string) => am != priceAlertMessage))];
                setAlertMessages(newAlerts);
            }

            updateMarketOrders(marketOrders, marketOrdersResponse, setMarketOrders, swap.market.base.name, prices[swap.market.base.name]);
            setCounter(counter + 1);
        } catch (error) {
            console.log(error);
            setCounter(counter + 1);
        }
    }

    const debounceRefresh = useMemo(
        () => {
            if (isOnChainData) {
                return debounce(() => refreshMarketOrders(true), 50);
            }
        }
    , [(swap.sell ? swap.inputAmounts.base : swap.inputAmounts.quote), swap.sell]);

    useEffect(() => {
        clearTimeout(timeoutId ?? 0);
        timeoutId = window.setTimeout(() => debounceRefresh ? debounceRefresh() : null, 500);
    }, [(swap.sell ? swap.inputAmounts.base : swap.inputAmounts.quote), swap.sell]);

    useEffect(() => {
        refreshQuotes();
    }, [(swap.sell ? swap.inputAmounts.base : swap.inputAmounts.quote), swap.sell, marketOrders]);

    useEffect(() => {
        if (wallet?.publicKey) {
            refreshUserBalances(wallet.publicKey);
        } else if (manualTransaction) {
            refreshUserBalances(manualTransaction);
        } else {
            setUserTokens(undefined);
        }
    }, [wallet?.publicKey, swap.market.address]);

    useEffect(() => {
        setTimeout(() => {
            refreshMarketOrders();
        }, 2000);
        if (counter % 15 == 0) {
            refreshMarketOrders(true);
        }
    }, [counter]);

    

    return (
        <div className="openbookswap swap-container" style={style}>
            {/* <IntroMessage /> */}
            <div className={`swap-container-box flex column between items-center`}>
                {
                    alertMessages.length > 0 ?
                    (
                        <div className="alert-container flex column">
                            {
                                alertMessages.map((am) => <span>{am}</span>)
                            }
                        </div>
                    ) : ''
                }
                <div className="swap-container-content flex column items-center">
                    <div className="flex w-100 center">
                        <h1 className="swap-title">{title}</h1>
                    </div>
                    <div className="swap-container-content-pair flex column items-center">
                        <div className="flex column mt-2 w-100">
                            <div className="flex items-center between">
                                <h4>From:</h4>
                                { (swap.sell ? userTokens?.amountBaseToken : userTokens?.amountQuoteToken) || 
                                (swap.sell ? userTokens?.amountBaseToken : userTokens?.amountQuoteToken) == 0 ? <div className="balance flex items-center"><span>Balance:</span> <span>{swap.sell ? (
                                        userTokens?.amountBaseToken && userTokens?.amountBaseToken > 10000 ? (userTokens?.amountBaseToken / 1000).toLocaleString() + 'K' : userTokens?.amountBaseToken.toLocaleString()
                                    ) : (
                                        userTokens?.amountQuoteToken && userTokens?.amountQuoteToken > 10000 ? (userTokens?.amountQuoteToken / 1000).toLocaleString() + 'K' : userTokens?.amountQuoteToken.toLocaleString()
                                    )}</span></div> : null }
                            </div>
                            <TokenInput
                                markets={markets}
                                pair={swap.market}
                                amount={swap.sell ? swap.inputAmounts.base : swap.inputAmounts.quote}
                                onValueChange={(value) => {
                                    const amount = value && value != '.' ? value : "";
                                    setSwap({...swap, inputAmounts: {
                                        ...swap.inputAmounts, 
                                        quote: swap.sell ? swap.inputAmounts.quote : amount,
                                        base: swap.sell ? amount : swap.inputAmounts.base }});
                                }}
                                balance={swap.sell ? userTokens?.amountBaseToken : userTokens?.amountQuoteToken}
                                setPair={(pair: MarketDetails, newToken: string) => {
                                    if (swap.market.address != pair.address) {
                                        setMarketOrders(marketOrdersInit);
                                    }
                                    setSwap({...swap, market: pair, sell: pair.base.name == newToken ? true : false});
                                    refreshMarketOrders(isOnChainData, pair.address);
                                    
                                }}
                                token={swap.sell ? {...swap.market.base, price: prices[swap.market.base.name]} : {...swap.market.quote, price: prices[swap.market.quote.name]}}
                            />
                        </div>
                        <div className="swap-switch mt-5 w-100">
                            <button className="flex center items-center p-1" onClick={switchPair}>
                                {/* <IconSwap fill="transparent" /> */}
                                <img src={swapImage} alt='logo' />
                            </button>
                        </div>
                        <div className="flex column mt-3 w-100">
                            <div className="flex items-center between">
                                <h4>To:</h4>
                                { (!swap.sell ? userTokens?.amountBaseToken : userTokens?.amountQuoteToken) || 
                                (!swap.sell ? userTokens?.amountBaseToken : userTokens?.amountQuoteToken) == 0 ? <div className="balance flex items-center"><span>Balance:</span><span>{!swap.sell ? (
                                    userTokens?.amountBaseToken && userTokens?.amountBaseToken > 10000 ? (Number(userTokens?.amountBaseToken / 1000)).toLocaleString() + 'K' : userTokens?.amountBaseToken.toLocaleString()
                                ) : (
                                    userTokens?.amountQuoteToken && userTokens?.amountQuoteToken > 10000 ? (Number(userTokens?.amountQuoteToken / 1000)).toLocaleString() + 'K' : userTokens?.amountQuoteToken.toLocaleString()
                                )}</span></div> : null }
                            </div>
                            <TokenQuote 
                                markets={markets}
                                amountNumber={swap.sell ? swap.amounts.quote : swap.amounts.base}
                                token={swap.sell ? {...swap.market.quote, price: prices[swap.market.quote.name]} : {...swap.market.base, price: prices[swap.market.base.name]}}
                                setPair={(pair: MarketDetails) => {
                                    if (swap.market.address != pair.address) {
                                        setMarketOrders(marketOrdersInit);
                                    }
                                    setSwap({...swap, market: pair});
                                    refreshMarketOrders(isOnChainData, pair.address);
                                }}
                                pair={swap.market}
                            />                   
                        </div>
                    </div>
                    <div className={`price-analysis-container ${priceAccuracy == 0 ? 'no-display': ''}`}>
                        <div className='flex start'>
                            <div className='flex column mt-3 '>
                                <div className={`flex column ${priceAccuracy > 2 ? 'bad-price' : (priceAccuracy > 1 ? 'fair-price' : (priceAccuracy > 0 ? 'good-price' : 'great-price')) }`}>
                                    <div className='flex gap-smaller items-center'>
                                        <span>{priceAccuracy > 2 ? 'Bad' : (priceAccuracy > 1 ? 'Fair' : (priceAccuracy > 0 ? 'Good' : 'Great'))} Price: </span>
                                        <span className=''>{priceAccuracy < 2 && priceAccuracy > 0 ? 'within' : ''} {priceAccuracy > 0 ? priceAccuracy.toFixed(2) : (-1 * priceAccuracy).toFixed(2)}% {priceAccuracy < 0 ? 'cheaper' : (priceAccuracy > 2 ? 'more expensive' : '')}</span>
                                    </div>
                                    <span className='small-text-detail'>({swap.slotConsumed} slot{swap.slotConsumed > 1 ? 's' : ''} consumed)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-3 w-100">
                    {
                        (wallet?.connected && wallet.publicKey) || (manualTransaction) ? 
                            <button disabled={loadingSwap || swap.slotConsumed > 1 ||
                                    (swap.sell && (userTokens?.amountBaseToken ?? 0) < (parseFloat(swap.inputAmounts.base) ?? 0)) || 
                                    (!swap.sell && (userTokens?.amountQuoteToken ?? 0) < (parseFloat(swap.inputAmounts.quote) ?? 0)) || 
                                    ((!swap.sell && swap.amounts.base < swap.market.minBase) || (swap.sell && parseFloat(swap.inputAmounts.base) < swap.market.minBase)) ||
                                    ((swap.sell && parseFloat(swap.inputAmounts.base ? swap.inputAmounts.base : '0') == 0 || !swap.sell && parseFloat(swap.inputAmounts.quote ? swap.inputAmounts.quote : '0') == 0)) } onClick={() => processOrder()} className="wallet-adapter-button wallet-adapter-button-trigger">
                                        <div className="flex column">
                                            {
                                                ((!swap.sell && swap.amounts.base < swap.market.minBase) || (swap.sell && parseFloat(swap.inputAmounts.base) < swap.market.minBase)) ? (
                                                    `Minimum ${swap.market.minBase} ${swap.market.base.name}`
                                                ) : (
                                                    swap.slotConsumed > 1 || priceAccuracy > 2 ? 'Not enough liquidity ⚠️' :
                                                    swap.sell ? (
                                                        (parseFloat(swap.inputAmounts.base) > 0) ?
                                                        ((userTokens?.amountBaseToken ?? 0) >= (parseFloat(swap.inputAmounts.base) ?? 0) ? 'Swap ' : 'Insufficent Balance') : 'Enter a Value'
                                                    ) : (
                                                        (parseFloat(swap.inputAmounts.quote) > 0) ?
                                                        ((userTokens?.amountQuoteToken ?? 0) >= (parseFloat(swap.inputAmounts.quote) ?? 0) ? 'Swap' : 'Insufficent Balance') : 'Enter a Value'
                                                    )
                                                )
                                            }
                                        </div>
                            </button> 
                        : 
                            <button disabled className="wallet-adapter-button wallet-adapter-button-trigger">Connect Wallet</button>
                    }
                </div>
            </div>
            <a className="powered-by-openbookswap" href='#' target="_blank">Powered by OpenBookSwap</a>
        </div>
        
    )
}

export interface SwapContainerProps {
    title: string;
    connection: Connection;
    onSwapSuccess: (success: SwapSuccess) => void;
    onSwapError: (error: SwapError) => void;
    onSwapLoading: (loading: SwapLoading) => void;
    colors?: SwapContainerColors;
    markets: SwapMarket[];
    wallet?: WalletContextState;
    manualTransaction?: PublicKey;
    onSwap?: (swap: ManualSwap) => void;
}

export interface SwapContainerColors {
    background?: string;
    swapButton?: string;
    primary?: string;
    secondary?: string;
    text?: string;
}

export interface SwapCallback {
    message: string;
    signature?: string;
}

export interface SwapLoading extends SwapCallback {
    swapResult: SwapDetail;
}

export interface SwapError extends SwapCallback {}

export interface ManualSwap {
    swapResult: SwapDetail;
    setLoadingSwap: React.Dispatch<React.SetStateAction<boolean>>;
    refreshUserBalances: (owner: PublicKey) => void;
}

export interface SwapSuccess extends SwapCallback {
    market: MarketDetails;
    signature: string;
    differences: {
        base: number|null;
        quote: number|null;
    }
}
