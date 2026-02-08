import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { PasswordInput } from "@/ui/elements/password-input"

export const ApiKey = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField label="API Key">
        <PasswordInput
            placeholder={`Enter API Key`}
            value={model.apiKey || ""}
            onChange={(value) => setModel({ ...model, apiKey: value })}
        />
    </FormField>)

}
