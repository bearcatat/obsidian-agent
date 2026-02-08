import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"

export const ModelName = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField
        label="Model Name"
        required
    >
        <Input
            type="text"
            placeholder={`Enter model name (e.g. "gpt-4")`}
            value={model.name}
            onChange={(e) => setModel({ ...model, name: e.target.value })}
        />
    </FormField>)

}
