import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK, type IWeb3AuthConfiguration } from '@web3auth/base'
import { CommonPrivateKeyProvider, type CommonPrivateKeyProviderConfig } from '@web3auth/base-provider'
import { Web3Auth, type Web3AuthOptions } from '@web3auth/modal'
import {
  DEFAULT_ALGORAND_CHAIN_CONFIG,
  DEFAULT_UI_CONFIG,
  DEFAULT_WEB3AUTH_NETWORK,
  type AlgorandWeb3AuthConfig,
} from './types'

let web3authInstance: Web3Auth | null = null

const sanitizeChainConfig = (chainConfig?: CommonPrivateKeyProviderConfig['config']['chainConfig']) => {
  if (!chainConfig) return DEFAULT_ALGORAND_CHAIN_CONFIG
  return {
    ...DEFAULT_ALGORAND_CHAIN_CONFIG,
    ...chainConfig,
    chainNamespace: chainConfig.chainNamespace ?? CHAIN_NAMESPACES.OTHER,
  }
}

const sanitizeUiConfig = (uiConfig?: IWeb3AuthConfiguration['uiConfig']) => ({
  ...DEFAULT_UI_CONFIG,
  ...uiConfig,
})

export async function initWeb3Auth(config: AlgorandWeb3AuthConfig): Promise<Web3Auth> {
  if (web3authInstance) {
    return web3authInstance
  }

  const chainConfig = sanitizeChainConfig(config.chainConfig)
  const uiConfig = sanitizeUiConfig(config.uiConfig)
  const web3AuthNetwork = config.web3AuthNetwork ?? DEFAULT_WEB3AUTH_NETWORK

  const privateKeyProvider = new CommonPrivateKeyProvider({
    config: {
      chainConfig,
    },
  })

  const web3AuthConfig: Web3AuthOptions = {
    clientId: config.clientId,
    web3AuthNetwork,
    privateKeyProvider,
    uiConfig,
  }

  web3authInstance = new Web3Auth(web3AuthConfig)
  await web3authInstance.initModal()

  return web3authInstance
}

export function getWeb3AuthInstance(): Web3Auth | null {
  return web3authInstance
}

export function getWeb3AuthProvider(): IProvider | null {
  return web3authInstance?.provider || null
}

export function isWeb3AuthConnected(): boolean {
  return web3authInstance?.status === 'connected'
}

export interface Web3AuthUserInfo {
  email?: string
  name?: string
  profileImage?: string
  [key: string]: unknown
}

export async function getWeb3AuthUserInfo(): Promise<Web3AuthUserInfo | null> {
  if (!web3authInstance || !isWeb3AuthConnected()) {
    return null
  }

  try {
    const userInfo = await web3authInstance.getUserInfo()
    return userInfo as Web3AuthUserInfo
  } catch {
    return null
  }
}

export async function logoutFromWeb3Auth(): Promise<void> {
  if (!web3authInstance) {
    return
  }

  try {
    await web3authInstance.logout()
  } finally {
    web3authInstance = null
  }
}
