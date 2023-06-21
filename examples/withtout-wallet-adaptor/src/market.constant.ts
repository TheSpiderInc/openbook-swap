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