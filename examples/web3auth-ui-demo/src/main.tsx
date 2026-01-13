import React from 'react'
import ReactDOM from 'react-dom/client'
import { Web3AuthGoogleButton } from '@tokenizerwa/web3auth-algorand-ui'
import { AlgorandWeb3AuthProvider } from '@tokenizerwa/web3auth-algorand'
import './styles.css'

const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || ''

function App() {
  return (
    <div className="page">
      <header>
        <h1>Algorand + Web3Auth Demo</h1>
        <p>Sign in with Google and get an Algorand signer instantly.</p>
      </header>

      <AlgorandWeb3AuthProvider config={{ clientId: WEB3AUTH_CLIENT_ID }}>
        <section className="card">
          <h2>Connect</h2>
          <p>Use the ready-made Google button from the UI package.</p>
          <Web3AuthGoogleButton />
        </section>
      </AlgorandWeb3AuthProvider>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
