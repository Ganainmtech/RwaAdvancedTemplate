import { IProvider } from '@web3auth/base'
import { Web3Auth } from '@web3auth/modal'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { AlgorandAccountFromWeb3Auth, getAlgorandAccount } from '../utils/web3auth/algorandAdapter'
import { getWeb3AuthUserInfo, initWeb3Auth, logoutFromWeb3Auth, Web3AuthUserInfo } from '../utils/web3auth/web3authConfig'

interface Web3AuthContextType {
  isConnected: boolean
  isLoading: boolean
  isInitialized: boolean
  error: string | null
  provider: IProvider | null
  web3AuthInstance: Web3Auth | null
  algorandAccount: AlgorandAccountFromWeb3Auth | null
  userInfo: Web3AuthUserInfo | null
  login: () => Promise<void>
  logout: () => Promise<void>
  refreshUserInfo: () => Promise<void>
}

const Web3AuthContext = createContext<Web3AuthContextType | undefined>(undefined)

export function Web3AuthProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [provider, setProvider] = useState<IProvider | null>(null)
  const [web3AuthInstance, setWeb3AuthInstance] = useState<Web3Auth | null>(null)
  const [algorandAccount, setAlgorandAccount] = useState<AlgorandAccountFromWeb3Auth | null>(null)
  const [userInfo, setUserInfo] = useState<Web3AuthUserInfo | null>(null)

  useEffect(() => {
    const initializeWeb3Auth = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const web3auth = await initWeb3Auth()

        setWeb3AuthInstance(web3auth)

        if (web3auth.status === 'connected' && web3auth.provider) {
          setProvider(web3auth.provider)
          setIsConnected(true)

          try {
            const account = await getAlgorandAccount(web3auth.provider)
            setAlgorandAccount(account)
          } catch (err) {
            setError('Failed to derive Algorand account. Please reconnect.')
          }

          try {
            const userInformation = await getWeb3AuthUserInfo()
            if (userInformation) {
              setUserInfo(userInformation)
            }
          } catch (err) {
            console.error('🎯 Failed to fetch user info:', err)
          }
        }

        setIsInitialized(true)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Web3Auth'
        console.error('🎯 WEB3AUTHPROVIDER: Initialization error:', err)
        setError(errorMessage)
        setIsInitialized(true)
      } finally {
        setIsLoading(false)
      }
    }

    initializeWeb3Auth()
  }, [])

  const login = async () => {

    if (!web3AuthInstance) {
      console.error('🎯 LOGIN: Web3Auth not initialized')
      setError('Web3Auth not initialized')
      return
    }

    if (!isInitialized) {
      console.error('🎯 LOGIN: Web3Auth still initializing')
      setError('Web3Auth is still initializing, please try again')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const web3authProvider = await web3AuthInstance.connect()

      if (!web3authProvider) {
        throw new Error('Failed to connect Web3Auth provider')
      }

      setProvider(web3authProvider)
      setIsConnected(true)

      try {
        const account = await getAlgorandAccount(web3authProvider)
        setAlgorandAccount(account)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to derive Algorand account'
        setError(errorMessage)
      }

      try {
        const userInformation = await getWeb3AuthUserInfo()
        if (userInformation) {
          setUserInfo(userInformation)
        }
      } catch (err) {
        console.error('🎯 LOGIN: Failed to fetch user info:', err)
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      console.error('🎯 LOGIN: Error:', err)
      setError(errorMessage)
      setIsConnected(false)
      setProvider(null)
      setAlgorandAccount(null)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      setError(null)

      await logoutFromWeb3Auth()

      setProvider(null)
      setIsConnected(false)
      setAlgorandAccount(null)
      setUserInfo(null)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed'
      console.error('🎯 LOGOUT: Error:', err)
      setError(errorMessage)

      setProvider(null)
      setIsConnected(false)
      setAlgorandAccount(null)
      setUserInfo(null)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshUserInfo = async () => {
    try {
      const userInformation = await getWeb3AuthUserInfo()
      if (userInformation) {
        setUserInfo(userInformation)
      }
    } catch (err) {
      console.error('🎯 REFRESH: Failed:', err)
    }
  }

  const value: Web3AuthContextType = {
    isConnected,
    isLoading,
    isInitialized,
    error,
    provider,
    web3AuthInstance,
    algorandAccount,
    userInfo,
    login,
    logout,
    refreshUserInfo,
  }

  return <Web3AuthContext.Provider value={value}>{children}</Web3AuthContext.Provider>
}

export function useWeb3Auth(): Web3AuthContextType {
  const context = useContext(Web3AuthContext)

  if (context === undefined) {
    throw new Error('useWeb3Auth must be used within a Web3AuthProvider')
  }

  return context
}
