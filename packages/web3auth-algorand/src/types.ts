import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, type IWeb3AuthConfiguration } from '@web3auth/base'
import type { CommonPrivateKeyProviderConfig } from '@web3auth/base-provider'

export type { AlgorandAccountFromWeb3Auth } from './utils/algorandAdapter'

export interface AlgorandChainConfig extends CommonPrivateKeyProviderConfig['config']['chainConfig'] {}

export interface AlgorandWeb3AuthConfig {
  clientId: string
  web3AuthNetwork?: WEB3AUTH_NETWORK
  chainConfig?: AlgorandChainConfig
  uiConfig?: IWeb3AuthConfiguration['uiConfig']
}

export const DEFAULT_ALGORAND_CHAIN_CONFIG: AlgorandChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.OTHER,
  chainId: '0x1',
  rpcTarget: 'https://testnet-api.algonode.cloud',
  displayName: 'Algorand TestNet',
  blockExplorerUrl: 'https://testnet.algoexplorer.io',
  ticker: 'ALGO',
  tickerName: 'Algorand',
}

export const DEFAULT_UI_CONFIG: IWeb3AuthConfiguration['uiConfig'] = {
  appName: 'Algorand Web3Auth',
  mode: 'light',
  loginMethodsOrder: ['google'],
}

export const DEFAULT_WEB3AUTH_NETWORK = WEB3AUTH_NETWORK.SAPPHIRE_DEVNET
