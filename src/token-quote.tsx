import { MarketDetails, SwapMarket } from "./market";
import { useMemo } from "react";
import React from "react";
import { PairSearch } from "./pair-search";
import CurrencyInput from "react-currency-input-field";
import { Option } from "./option";
import { TokenAddressesDetails, TokenDetails } from "./token";

export function TokenQuote(props: { markets: SwapMarket[], token: TokenAddressesDetails, setPair: (pair: MarketDetails) => void, amountNumber: number, pair: MarketDetails }) {
    const pairToken: TokenDetails = useMemo(() => {
        return props.pair.base.mint.toString() == props.token.mint.toString() ? props.pair.quote : props.pair.base;
    }, [props.token]);

    const options: Option[] = useMemo(() => {
        const visited = new Set();
        const response: Option[] = [];
        props.markets.forEach((market: SwapMarket) => {
            if (!visited.has(market.base.name)) {
                response.push({
                    value: market.base.mint.toString(),
                    label: market.base.name,
                    imageUrl: market.base.logo,
                    pair: market
                });
                visited.add(market.base.name);
            }
            if (!visited.has(market.quote.name)) {
                response.push({
                    value: market.quote.mint.toString(),
                    label: market.quote.name,
                    imageUrl: market.quote.logo,
                    pair: market
                });
                visited.add(market.quote.name);
            }
        });
        return response.filter((option: Option) => option.value !== pairToken.mint.toString());
    }, [pairToken]);

    const currentOption: Option | null = useMemo(() => {
        try {
            return options.find((option: Option) => option.value === props.token.mint.toString()) ?? null;
        } catch (error) {
            return null;
        }
    }, [options]);

    return (
        <div className="flex row between mt-3 responsive-column">
            <div className="flex column center responsive-row">
                <PairSearch currentOption={currentOption} options={options} setPair={props.setPair} />
            </div>
        
            {
                Number(props.amountNumber?.toFixed(2)) < 0.01 &&  
                Number(props.amountNumber) > 0 ?
                (
                    <div className={`input-wrapper no-input-section`}>
                            {
                                props.amountNumber * props.token.price >= 0.0001 ?
                                <span className="token-dollars-value">{`≈$${Number(props.amountNumber * props.token.price).toLocaleString(undefined, {minimumFractionDigits: 4})}`}</span> :
                                <span className="token-dollars-value">{'<$0.0001'}</span>
                            }
                        <span className={`input-style small-sign-position ${props.amountNumber > 0 ? 'move-top': ''}`}>{'<'}</span>
                        <CurrencyInput
                            className={`${props.amountNumber > 0 ? 'move-top': ''}`}
                            disabled={true}
                            placeholder="0.00"
                            value={0.01}
                            decimalsLimit={10}
                            allowNegativeValue={false}
                            step={props.token.name == 'BONK' ? 1000 : 0.01}
                        />
                    </div>
                ) : 
                (
                    <div className={`input-wrapper no-input-section`}>
                        {
                            props.amountNumber > 0 &&
                            <span className="token-dollars-value">≈${Number(props.amountNumber * props.token.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        }
                        <CurrencyInput
                            className={`${props.amountNumber > 0 ? 'move-top': ''}`}
                            disabled={true}
                            placeholder="0.00"
                            value={props.amountNumber?.toFixed(2)}
                            decimalsLimit={10}
                            allowNegativeValue={false}
                            step={props.token.name == 'BONK' ? 1000 : 0.01}
                        />
                    </div>
                )
                
            }
        </div>
    )
}