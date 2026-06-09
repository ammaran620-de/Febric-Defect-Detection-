import React, { createContext, useContext, useState } from 'react'

const NavigationContext = createContext(null)

export function NavigationProvider({ children }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('standards')

  return (
    <NavigationContext.Provider value={{ activeSettingsTab, setActiveSettingsTab }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  return useContext(NavigationContext)
}
