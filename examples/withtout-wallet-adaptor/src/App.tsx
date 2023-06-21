import { ManualSwap, SwapContainer, SwapError } from '@thespidercode/openbook-swap';
import { marketPairs } from './market.constant';
import * as web3 from '@solana/web3.js';
import { useState } from 'react';

function App() {
    const connection = new web3.Connection('<RPC URL>');
    const [provider, setProvider] = useState<any>(null);
    
    const getProvider = async (): Promise<any> => {
      if ("solana" in window) {
        try {
          await ((window  as any).solana).connect();
          const provider = (window  as any).solana;
          if ((provider as any).isPhantom) {
            setProvider(provider);
            return provider;
          }
        } catch (error) {
          console.log(error);
        }
      } else {
        window.open("https://www.phantom.app/", "_blank");
      }
    }

    const releaseProvider = async (): Promise<void> => {
      if (provider) {
        provider.disconnect();
        setProvider(null);
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

        const latestBlockHash = await connection.getLatestBlockhash();
        loading.swapResult.transaction.transaction.recentBlockhash = latestBlockHash.blockhash;
        loading.swapResult.transaction.transaction.feePayer = new web3.PublicKey(provider.publicKey);

        for (let i = 0; i < loading.swapResult.transaction.signers.length; i++) {
          loading.swapResult.transaction.transaction.partialSign(loading.swapResult.transaction.signers[i]);
        }

        const signed = await provider.signTransaction(loading.swapResult.transaction.transaction);
        const orderSignature = await connection.sendRawTransaction(signed.serialize());

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
            provider && provider.publicKey && <button onClick={() => releaseProvider()}>DISCONNECT {provider.publicKey.toString()}</button>
          }
          {
            provider && provider.publicKey ?
            <SwapContainer
                title='Swap'
                markets={marketPairs} 
                connection={connection}
                onSwapError={onSwapError}
                onSwap={onSwap}
                onSwapLoading={() => {}}
                onSwapSuccess={() => {}}
                manualTransaction={provider.publicKey}
            /> : <button onClick={() => getProvider()}>CONNECT</button>
          }
        </div>
        
    )
}

export default App;
