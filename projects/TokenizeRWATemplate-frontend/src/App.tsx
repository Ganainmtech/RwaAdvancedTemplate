import { SupportedWallet, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { Analytics } from '@vercel/analytics/react'
import { SnackbarProvider } from 'notistack'
import { useMemo } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './Home'
import Layout from './Layout'
import TokenizeMintPage from './TokenizeMintPage'
import TokenizeNftPage from './TokenizeNftPage'
import TokenizeTransferPage from './TokenizeTransferPage'
import { getAlgodConfigFromViteEnvironment, getKmdConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'

const web3AuthClientId = (import.meta.env.VITE_WEB3AUTH_CLIENT_ID ?? '').trim()

function buildSupportedWallets(): SupportedWallet[] {
  if (import.meta.env.VITE_ALGOD_NETWORK === 'localnet') {
    const kmdConfig = getKmdConfigFromViteEnvironment()
    return [
      {
        id: WalletId.KMD,
        options: {
          baseServer: kmdConfig.server,
          token: String(kmdConfig.token),
          port: String(kmdConfig.port),
        },
      },
      { id: WalletId.LUTE },
    ]
  }

  const wallets: SupportedWallet[] = [{ id: WalletId.PERA }, { id: WalletId.DEFLY }, { id: WalletId.LUTE }]

  if (web3AuthClientId) {
    wallets.push({
      id: WalletId.WEB3AUTH,
      options: {
        clientId: web3AuthClientId,
        web3AuthNetwork: 'sapphire_devnet',
        uiConfig: {
          appName: 'Tokenize RWA Template',
          mode: 'auto',
        },
      },
    })
  }

  return wallets
}

export default function App() {
  const algodConfig = getAlgodConfigFromViteEnvironment()

  const supportedWallets = useMemo(() => buildSupportedWallets(), [])
  const walletManager = useMemo(() => {
    return new WalletManager({
      wallets: supportedWallets,
      defaultNetwork: algodConfig.network,
      networks: {
        [algodConfig.network]: {
          algod: {
            baseServer: algodConfig.server,
            port: algodConfig.port,
            token: String(algodConfig.token),
          },
        },
      },
      options: {
        resetNetwork: true,
      },
    })
  }, [algodConfig.network, algodConfig.server, algodConfig.port, algodConfig.token, supportedWallets])

  return (
    <SnackbarProvider maxSnack={3}>
      <WalletProvider manager={walletManager}>
        <BrowserRouter>
          <Analytics />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />

              {/* redirect legacy /tokenize to mint */}
              <Route path="/tokenize" element={<Navigate to="/tokenize/mint" replace />} />

              {/* new split pages */}
              <Route path="/tokenize/mint" element={<TokenizeMintPage />} />
              <Route path="/tokenize/nft" element={<TokenizeNftPage />} />
              <Route path="/tokenize/transfer" element={<TokenizeTransferPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </SnackbarProvider>
  )
}
