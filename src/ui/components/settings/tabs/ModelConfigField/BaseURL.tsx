import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"

export const BaseUrl = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField label="Base URL">
        <Input
            type="text"
            placeholder={"https://api.example.com/v1"}
            value={model.baseUrl}
            onChange={(e) => setModel({ ...model, baseUrl: e.target.value })}
        />
    </FormField>)

}
