import { Option } from "./option"
import React from "react";

export function SearchPairButton (props: { currentOption: Option | null, onClick?: () => void}) {
    return (
        <button className="search-pair-button flex items-center gap-small" onClick={props.onClick}>
            <img src={props.currentOption?.imageUrl} alt="" />
            <h3>{props.currentOption?.label}</h3>
            <h3 className="ml-2" style={{fontSize: "18px"}}>&#x25BC;</h3>
        </button>
    )
}