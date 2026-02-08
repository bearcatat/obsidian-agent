import { ModelConfig } from "@/types"
import { DisplayName } from "../ModelConfigField/DisplayName"
import { ModelName } from "../ModelConfigField/ModelName"
import { BaseUrl } from "../ModelConfigField/BaseURL"
import { ApiKey } from "../ModelConfigField/ApiKey"
import { Provider } from "../ModelConfigField/Provider"

export const CommonModelConfig = ({ model, setModel, dialogElement }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
    dialogElement: HTMLDivElement | null
}) => {
    return (
        <div className="tw-space-y-3">
            <DisplayName model={model} setModel={setModel}></DisplayName>
            <ModelName model={model} setModel={setModel}></ModelName>
            <Provider model={model} setModel={setModel} dialogElement={dialogElement}></Provider>
            <BaseUrl model={model} setModel={setModel}></BaseUrl>
            <ApiKey model={model} setModel={setModel}></ApiKey>
        </div>
    )
}