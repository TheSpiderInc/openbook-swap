import { useMemo, useState } from "react";
import { MarketDetails } from "./market";
import { Option } from "./option";
import React from "react";
import { SearchPairButton } from "./search-pair-button";

export function PairSearch(props: { currentOption: Option | null, options: Option[], setPair: (pair: MarketDetails, newToken: string) => void}) {

    const [modalOpen, setModalOpen] = useState(false);
    const [inputSearch, setInputSearch] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputSearch((e.target as any).value);
    };

    const options: Option[] = useMemo(() => {
        let response: Option[] = [];
        response = props.options.filter((option: Option) => {
            return option.label.toLocaleLowerCase().includes(inputSearch.toLocaleLowerCase());
        });
        return response;
    }, [inputSearch, props.options]);

    const setNewPair = (newValue: Option) => {
        if(props.setPair && newValue?.pair) {
            props.setPair(newValue.pair, newValue.label);
        }
    }

    const closeModal = () => {
        setModalOpen(false);
    }

    return (
        <div>
            <SearchPairButton
                onClick={() => setModalOpen(true)}
                currentOption={props.currentOption}
            />
            {
                modalOpen &&
                <div className="openbookswap modal-overlay" onClick={closeModal}>
                    <div className="obs-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={closeModal}>✕</button>
                        <div className="modal-content">
                            <div className='search-tokens'>
                                <input autoFocus placeholder='Search tokens' value={inputSearch} onChange={handleInputChange} type='text' />
                            </div>
                            <div className='token-options flex column start mt-4'>
                                {
                                    options.length > 0 && options.map((option: Option) => {
                                        return (
                                            <div className='token-option flex start items-center' key={option.value} onClick={(e) => {
                                                setNewPair(option);
                                                closeModal();
                                            }}>
                                                <img src={option.imageUrl} />
                                                <h3>{option.label}</h3>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </div>
                    </div>
                </div>
            }
        </div>
    )
}