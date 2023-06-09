import { MarketDetails } from "./market";

export interface Option {
    value: string;
    label: string;
    imageUrl: string;
    pair: MarketDetails;
}