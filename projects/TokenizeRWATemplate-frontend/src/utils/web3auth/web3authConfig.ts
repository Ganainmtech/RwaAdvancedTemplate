import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from '@web3auth/base'
import { CommonPrivateKeyProvider } from '@web3auth/base-provider'
import { Web3Auth } from '@web3auth/modal'

let web3authInstance: Web3Auth | null = null

export async function initWeb3Auth(): Promise<Web3Auth> {

  if (web3authInstance) {
    return web3authInstance
  }

  const clientId = import.meta.env.VITE_WEB3AUTH_CLIENT_ID

  if (!clientId) {
    const error = new Error('VITE_WEB3AUTH_CLIENT_ID is not configured')
    console.error('❌ ERROR:', error.message)
    throw error
  }

  try {

    // Create the private key provider for Algorand
    const privateKeyProvider = new CommonPrivateKeyProvider({
      config: {
        chainConfig: {
          chainNamespace: CHAIN_NAMESPACES.OTHER,
          chainId: '0x1',
          rpcTarget: 'https://testnet-api.algonode.cloud',
          displayName: 'Algorand TestNet',
          blockExplorerUrl: 'https://testnet.algoexplorer.io',
          ticker: 'ALGO',
          tickerName: 'Algorand',
        },
      },
    })

    const web3AuthConfig = {
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      privateKeyProvider, // ← THIS IS REQUIRED!
      uiConfig: {
        appName: 'TokenizeRWA',
        theme: {
          primary: '#000000',
        },
        mode: 'light' as const,
        loginMethodsOrder: ['google', 'facebook', 'github', 'twitter'],
        defaultLanguage: 'en',
      },
    }

    web3authInstance = new Web3Auth(web3AuthConfig)

    await web3authInstance.initModal()

    return web3authInstance
  } catch (error) {
    throw error
  }
}

export function getWeb3AuthInstance(): Web3Auth | null {
  return web3authInstance
}

export function getWeb3AuthProvider(): IProvider | null {
  const provider = web3authInstance?.provider || null
  return provider
}

export function isWeb3AuthConnected(): boolean {
  const connected = web3authInstance?.status === 'connected'
  return connected
}

export interface Web3AuthUserInfo {
  email?: string
  name?: string
  profileImage?: string
  typeOfLogin?: string
  [key: string]: unknown
}

export async function getWeb3AuthUserInfo(): Promise<Web3AuthUserInfo | null> {
  if (!web3authInstance || !isWeb3AuthConnected()) {
    return null
  }

  try {
    const userInfo = await web3authInstance.getUserInfo()
    return userInfo as Web3AuthUserInfo
  } catch (error) {
    return null
  }
}

export async function logoutFromWeb3Auth(): Promise<void> {

  if (!web3authInstance) {
    return
  }

  try {
    await web3authInstance.logout()
  } catch (error) {
    throw error
  }
}
