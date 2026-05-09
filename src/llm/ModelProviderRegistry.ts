import { ModelProviderStrategy } from "@/types";

export default class ModelProviderRegistry {
    private readonly strategies = new Map<string, ModelProviderStrategy>();

    constructor(strategies: ModelProviderStrategy[]) {
        strategies.forEach((strategy) => {
            this.strategies.set(strategy.provider, strategy);
        });
    }

    get(provider: string): ModelProviderStrategy {
        const strategy = this.find(provider);
        if (!strategy) {
            throw new Error(`provider not found: ${provider}`);
        }

        return strategy;
    }

    find(provider: string): ModelProviderStrategy | undefined {
        return this.strategies.get(provider);
    }
}
