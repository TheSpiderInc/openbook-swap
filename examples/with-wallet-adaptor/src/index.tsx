import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { MoongateWalletAdapter } from "@moongate/moongate-adapter";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

const endpoint = "<RPC URL>";
const wallets = [
  new PhantomWalletAdapter(),
  new MoongateWalletAdapter({ position: "bottom-right" }),
];

root.render(
  <ConnectionProvider endpoint={endpoint}>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <App />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);
