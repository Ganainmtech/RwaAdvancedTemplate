import { useWallet } from '@txnlab/use-wallet-react'
import { useMemo } from 'react'
import { useWeb3Auth } from '../components/Web3AuthProvider'
import { createWeb3AuthSigner } from '../utils/web3auth/web3authIntegration'
import { WALLET_ADAPTERS } from '@web3auth/base'

export type SocialLoginProvider = 'google' | 'facebook' | 'github'

export function useUnifiedWallet() {
  const { isConnected, algorandAccount, userInfo, login, logout, isLoading } = useWeb3Auth()
  const traditional = useWallet()

  return useMemo(() => {
    // Determine which source is actually providing an account
    const isWeb3AuthActive = isConnected && !!algorandAccount
    const isTraditionalActive = !!traditional.activeAddress

    const activeAddress = isWeb3AuthActive ? algorandAccount!.address : traditional.activeAddress || null

    const connectWithSocial = async (provider: SocialLoginProvider) => {
      await login(WALLET_ADAPTERS.AUTH, provider)
    }

    return {
      activeAddress,
      isConnected: !!activeAddress,
      walletType: isWeb3AuthActive ? 'web3auth' : isTraditionalActive ? 'traditional' : null,
      isLoading,

      // Connection Methods
      connectSocial: connectWithSocial,
      connectGoogle: async () => connectWithSocial('google'),
      connectFacebook: async () => connectWithSocial('facebook'),
      connectGithub: async () => connectWithSocial('github'),

      disconnect: async () => {
        if (isWeb3AuthActive) await logout()
        if (isTraditionalActive) await traditional.activeWallet?.disconnect()
      },

      // Metadata
      userInfo,
      traditionalWallets: traditional.wallets,
      signer: isWeb3AuthActive ? createWeb3AuthSigner(algorandAccount) : traditional.transactionSigner,
    }
  }, [isConnected, algorandAccount, userInfo, traditional, isLoading])
}
