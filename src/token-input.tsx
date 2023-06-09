import { useMemo } from "react";
import { MarketDetails, SwapMarket } from "./market";
import React from "react";
import { Option } from "./option";
import { PairSearch } from "./pair-search";
import CurrencyInput from "react-currency-input-field";
import { TokenAddressesDetails, TokenDetails } from "./token";

export function TokenInput(props: { markets: SwapMarket[], token: TokenAddressesDetails, setPair: (pair: MarketDetails, newToken: string) => void, amount: string, pair: MarketDetails, onValueChange: (value: any) => void, balance: number | undefined }) {
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
        return response;
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
                <div className={`input-wrapper`}>
                    {
                        (props.amount && Number(props.amount) > 0) &&
                        <span className="token-dollars-value">≈${Number(Number(props.amount) * props.token.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    }
                    <div className={`balance-buttons ${Number(props.amount) > 0 || !props.balance ? 'no-display' : ''}`}>
                        <button onClick={() => props.onValueChange((props.balance ? (props.balance / 2) : 0).toFixed(3))}>HALF</button>
                        <button onClick={() => props.onValueChange(props.balance ? props.balance : 0)} >MAX</button>
                    </div>
                    <CurrencyInput
                        className={`${ props.amount && Number(props.amount) > 0 ? 'move-top': ''}`}
                        disabled={false}
                        placeholder="0.00"
                        value={props.amount}
                        decimalsLimit={10}
                        allowNegativeValue={false}
                        step={props.token.name == 'BONK' ? 1000 : 0.01}
                        onValueChange={props.onValueChange}
                    />
                </div>
            }
        </div>
    )
}

export interface TokenInputProps {
    sell: boolean;
    amount: string;
    onValueChange: (value: any) => void;
    input: boolean;
    amountNumber?: number;
    balance?: number;
    pair: MarketDetails;
    setPair?: (pair: MarketDetails) => void;
}