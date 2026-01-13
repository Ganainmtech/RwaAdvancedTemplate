# @tokenizerwa/web3auth-algorand

Algorand + Web3Auth hook and provider that turns a Google login into an Algorand signer. Ships the Web3Auth wiring, Algorand account derivation, and signer utilities so you can drop it into any React app.

## What’s inside
- `AlgorandWeb3AuthProvider` – wraps your app and bootstraps Web3Auth + Algorand account derivation.
- `useWeb3Auth()` – access connection state, Google profile info, and the derived Algorand account.
- `createWeb3AuthSigner(...)` – get an AlgoKit-compatible `TransactionSigner`.
- Helper utilities for balance/amount formatting and account inspection.

## Install
```bash
npm install @tokenizerwa/web3auth-algorand
# peer deps you likely already have
npm install react @web3auth/modal
```

## Quick start
```tsx
import { AlgorandWeb3AuthProvider, useWeb3Auth, createWeb3AuthSigner } from '@tokenizerwa/web3auth-algorand'

const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID

function ConnectButton() {
  const { isConnected, algorandAccount, login, logout, isLoading } = useWeb3Auth()

  if (isConnected && algorandAccount) {
    const signer = createWeb3AuthSigner(algorandAccount)
    // use signer with AlgoKit / algosdk
  }

  return (
    <button onClick={isConnected ? logout : login} disabled={isLoading}>
      {isConnected ? 'Disconnect' : 'Sign in with Google'}
    </button>
  )
}

export function App() {
  return (
    <AlgorandWeb3AuthProvider
      config={{
        clientId: WEB3AUTH_CLIENT_ID,
        // optional overrides:
        // web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        // chainConfig: { rpcTarget: 'https://mainnet-api.algonode.cloud', displayName: 'Algorand MainNet' },
      }}
    >
      <ConnectButton />
    </AlgorandWeb3AuthProvider>
  )
}
```

## UI add-on (optional)
If you want a plug-and-play Google button and dropdown, install the UI companion:
```bash
npm install @tokenizerwa/web3auth-algorand-ui
```
```tsx
import { AlgorandWeb3AuthProvider } from '@tokenizerwa/web3auth-algorand'
import { Web3AuthGoogleButton } from '@tokenizerwa/web3auth-algorand-ui'

<AlgorandWeb3AuthProvider config={{ clientId: WEB3AUTH_CLIENT_ID }}>
  <Web3AuthGoogleButton />
</AlgorandWeb3AuthProvider>
```

## Notes
- You need a Web3Auth client id from the Web3Auth dashboard.
- Default network is Sapphire Devnet + Algorand TestNet RPC; override via `config.chainConfig` and `config.web3AuthNetwork`.
- The provider must wrap any component that calls `useWeb3Auth`.
