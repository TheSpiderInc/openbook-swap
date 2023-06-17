# What is Openbook?
Openbook refers to a decentralized exchange (DEX) built on the Solana blockchain. It is designed to provide fast, secure, and low-cost trading of digital assets. Openbook leverages the Solana network's high throughput and low latency capabilities to enable efficient trading experiences.

Key features of Openbook include:

**Performance**: Built on Solana's high-performance blockchain, allowing for fast order execution and settlement times. The Solana network's scalability enables Serum to handle a high volume of transactions with minimal latency.

**Decentralization**: Decentralized exchange, meaning it operates without a central authority. It utilizes smart contracts on the Solana blockchain to execute trades, ensuring transparency and eliminating the need for intermediaries.

**Order Book**: Features a traditional order book model, where buyers and sellers can place limit orders at specific prices. This allows for efficient price discovery and liquidity provision.

**Cross-Chain Compatibility**: Designed to be cross-chain compatible, enabling users to trade assets from different blockchains.

Openbook aims to address some of the limitations faced by traditional centralized exchanges, such as high fees, slow transaction times, and lack of transparency. By leveraging the Solana blockchain's capabilities, Openbook aims to provide a decentralized trading platform that combines speed, security, and usability.

# Difference between DEX and AMM
The main distinction between a DEX and an AMM lies in their mechanisms for executing trades and determining prices. A DEX with an order book model relies on order matching between buyers and sellers, while an AMM operates through liquidity pools and a mathematical formula to determine prices.

# Why openbook-swap?
While most swap tools use AMMs (Automated Market Makers) to process swaps, Openbook-Swap aims to exclusively utilize the Openbook DEX (Decentralized Exchange) by employing an IOC (Instant Or Cancel) order mechanism. By promoting the use of the Openbook DEX, Openbook-Swap's goal is to attract more users and increase trading volume, thereby creating strong competition for AMMs. This competition will provide users with more options and, consequently, better prices.

# How to use?
## Installation
```
npm i @thespidercode/openbook-swap
npm i @solana/web3.js

*Optional*
npm install @solana/wallet-adapter
```

## Usage
### First Step
The first step is to define which markets you want to include. To do so, you need to add a `market.constant.ts` file in your project, which is an array of `SwapMarket` objects. 
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
            logo: "https://img.api.cryptorank.io/coins/bonk1672306100278.png",
            mint: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
            vault: new PublicKey('A9yRKSx8SyqNdCtCMUgr6wDXUs1JmVFkVno6FcscSD6m'),
        },
        quote: {
            name: "USDC",
            logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Circle_USDC_Logo.svg/512px-Circle_USDC_Logo.svg.png",
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
            logo: "https://img.api.cryptorank.io/coins/bonk1672306100278.png",
            mint: new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'),
            vault: new PublicKey('AVnL1McPPrn1dZyHGThwXzwYaHBp6sxB44vXoETPqH45'),
        },
        quote: {
            name: "SOL",
            logo: "https://img.api.cryptorank.io/coins/solana1606979093056.png",
            mint: new PublicKey('So11111111111111111111111111111111111111112'),
            vault: new PublicKey('8KftabityJoWgvUb6wwAPZww8mYmLq8WTMuQGGPoGiKM'),
        },
        minBase: 1000,
        swapMargin: 0.0004
    },
]
```
### Second step 
The second step involves calling the package, and there are two ways to do it:
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
                    primary: "var(--color-orange)",
                    secondary: "var(--color-purple-light)",
                    background: "var(--color-purple)",
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
    const wallet = useWallet();

    const getProvider = async () => {
      if ("solana" in window) {
        await window.solana.connect();
        const provider = window.solana;
        if (provider.isPhantom) {
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
        if (!loading.swapResult.transaction || !wallet.publicKey) {
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

        loading.refreshUserBalances(wallet.publicKey);
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
            <SwapContainer
                title='Swap'
                colors={{
                    primary: "var(--color-orange)",
                    secondary: "var(--color-purple-light)",
                    background: "var(--color-purple)",
                    text: "#fff",
                }}
                markets={marketPairs} 
                connection={connection}
                onSwapError={onSwapError}
                onSwap={onSwap}
                manualTransaction={wallet.publicKey}
            />
        </div>
        
    )
}
```
