import React from 'react';
import { App } from 'obsidian';

export const AppContext = React.createContext<App | undefined>(undefined);

export interface AppContextProviderProps {
	app: App;
	children: React.ReactNode;
}

export const AppContextProvider: React.FC<AppContextProviderProps> = ({ app, children }) => {
	return (
		<AppContext.Provider value={app}>
			{children}
		</AppContext.Provider>
	);
};

export const useApp = (): App | undefined => {
	return React.useContext(AppContext);
};