import React, { createContext, useContext, useState } from "react";

interface TabContextType {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
  modalContainer: HTMLElement | null;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabProviderProps {
  children: React.ReactNode;
  modalContainer?: HTMLElement | null;
}

export const TabProvider: React.FC<TabProviderProps> = ({ children, modalContainer = null }) => {
  const [selectedTab, setSelectedTab] = useState("model");

  return (
    <TabContext.Provider value={{ selectedTab, setSelectedTab, modalContainer }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTab = () => {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error("useTab must be used within a TabProvider");
  }
  return context;
};
