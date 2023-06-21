![Openbook Swap](https://github.com/TheSpiderInc/openbook-swap/blob/master/ob-swap.png?raw=true)

# OpenBookSwap Overview
OpenBookSwap aims to make token swaps on Solana easy with the Serum/OpenBook DEX smart contract v1 (v2 coming soon). This repository is a plug and play react component that can be implemented into your web application within minutes. Example: [OpenBonk.io](http://openbonk.io)

# Serum/OpenBook DEX
The [OpenBook DEX](https://github.com/openbook-dex) is a Solana smart contract, forked from Serum, that provides a complete limit order book on-chain.

# Features
- Customizable Colors
- Only 1 Transaction:
    - Create an Open Orders Account
    - Create the Associated Token Accounts
    - Initialize Accounts
    - Send an IOC Order (Immediate or Cancel)
    - Settle
- US Dollar Translations
- RPC Built In
- Low Liquidity Warnings

# Support
This project has received support from the Solana Foundation and Bonk Inu. We are committed to providing support atleast until July 2024. Feel free to contact @swolsol on telegram for support.

# How to Use?
## Installation
```
npm i @thespidercode/openbook-swap
npm i @solana/web3.js

*Optional*
npm install @solana/wallet-adapter
```

## Usage
### Step 1/2 Define your Markets
Decide which markets you want to include. Add a `market.constant.ts` file in your project, which is an array of `SwapMarket` objects. 
> SwapMarket
```typescript
interface SwapMarket {
    address: PublicKey;
    base: SwapMarketToken;
    quote: SwapMarketToken;
    minBase: number;
    swapMargin: number;
}
```
> Example of market.constant
```typescript
import { SwapMarket } from "@thespidercode/openbook-swap";
import { PublicKey } from "@solana/web3.js";

export const marketPairs: SwapMarket[] =[
    {
        address: new PublicKey('8PhnCfgqpgFM7ZJvttGdBVMXHuU4Q23ACxCvWkbs1M71'),
        base: {
            name: "BONK",
            logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/23095.png",
            mint: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
            vault: new PublicKey('A9yRKSx8SyqNdCtCMUgr6wDXUs1JmVFkVno6FcscSD6m'),
        },
        quote: {
            name: "USDC",
            logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png",
            mint: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
            vault: new PublicKey('D9dojzvwJGs4q3Cx8ytvD8kWVVZszoVKvPZEZ5D8PV1Y'),
        },
        minBase: 1000,
        swapMargin: 0.0004
    },
    {
        address: new PublicKey('Hs97TCZeuYiJxooo3U73qEHXg3dKpRL4uYKYRryEK9CF'),
        base: {
            name: "BONK",
            logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/23095.png",
            mint: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
            vault: new PublicKey('AVnL1McPPrn1dZyHGThwXzwYaHBp6sxB44vXoETPqH45'),
        },
        quote: {
            name: "SOL",
            logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png",
            mint: new PublicKey('So11111111111111111111111111111111111111112'),
            vault: new PublicKey('8KftabityJoWgvUb6wwAPZww8mYmLq8WTMuQGGPoGiKM'),
        },
        minBase: 1000,
        swapMargin: 0.0004
    },
]
```
### Step 2/2 Call the Package 
There are two options to call the package:
- Let the package handle the transaction by passing an instance of the wallet adaptor. This requires installing the wallet adaptor as mentioned above. The package will then manage the transaction delivery internally.
- Manually manage the delivery of the transaction. In this approach, the package provides a transaction that is ready to be sent. You have the responsibility of handling the transaction delivery process yourself.

> Using wallet adaptor
```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SwapContainer, SwapError, SwapLoading, SwapSuccess } from "@thespidercode/openbook-swap";
import { marketPairs } from '../constants/market.constant';

export function App() {
    const connection = useConnection().connection;
    const wallet = useWallet();
    
    const onSwapError = (error: SwapError): void => {
        console.log(error);
    }

    const onSwapLoading = (loading: SwapLoading): void => {
        console.log(loading);
    }

    const onSwapSuccess = (success: SwapSuccess): void => {
        console.log(success);
    }

    return (
        <div>
            <SwapContainer
                title='Swap'
                colors={{
                    primary: "grey",
                    secondary: "#3a3a3a",
                    background: "#1b1717",
                    swapButton: "grey",
                    text: "#fff",
                }}
                markets={marketPairs} 
                connection={connection}
                onSwapError={onSwapError}
                onSwapLoading={onSwapLoading}
                onSwapSuccess={onSwapSuccess}
                wallet={wallet}
            />
        </div>
        
    )
}
```

> Not using wallet adaptor
```tsx
import * as web3 from '@solana/web3.js';
import { ManualSwap, SwapContainer, SwapError } from "@thespidercode/openbook-swap";
import { marketPairs } from '../constants/market.constant';

export function App() {
    const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'));
    const [provider, setProvider] = useState<any>(null);

    const getProvider = async (): Promise<any> => {
      if ("solana" in window) {
        await (window.solana as any).connect();
        const provider = window.solana;
        if ((provider as any).isPhantom) {
          setProvider(provider);
          return provider;
        }
      } else {
        window.open("https://www.phantom.app/", "_blank");
      }
    }
    
    const onSwapError = (error: SwapError): void => {
        console.log(error);
    }

    const onSwap = async (loading: ManualSwap): Promise<void> => {
      try {
        const provider = await getProvider();
        if (!provider) return;
        
        if (!loading.swapResult.transaction || !provider.publicKey) {
          console.log('Loading object is missing required properties');
          return;
        }
        
        loading.setLoadingSwap(true);

        const signed = await provider.signTransaction(loading.swapResult.transaction.transaction);
        const orderSignature = await connection.sendRawTransaction(signed.serialize());
        const latestBlockHash = await connection.getLatestBlockhash();

        await connection.confirmTransaction({
          signature: orderSignature, 
          blockhash: latestBlockHash.blockhash, 
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight
        }, 'finalized');

        loading.refreshUserBalances(provider.publicKey);
        loading.setLoadingSwap(false);
      } catch (error) {
        console.log(error);
        if (loading.setLoadingSwap) {
          loading.setLoadingSwap(false);
        }
      }
    }

    return (
        <div>
            {
                provider && provider.publicKey ?
                <SwapContainer
                    title='Swap'
                    colors={{
                        primary: "grey",
                        secondary: "#3a3a3a",
                        background: "#1b1717",
                        swapButton: "grey",
                        text: "#fff",
                    }}
                    markets={marketPairs} 
                    connection={connection}
                    onSwapError={onSwapError}
                    onSwap={onSwap}
                    manualTransaction={provider.publicKey}
                /> : 
                <button onClick={() => getProvider()}>CONNECT</button>
            }
        </div>
        
    )
}
```
