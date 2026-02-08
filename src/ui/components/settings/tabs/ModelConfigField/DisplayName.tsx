import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"

export const DisplayName = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField
        label="Display Name(ID)"
        required
    >
        <Input
            type="text"
            placeholder="Display Name(ID)"
            value={model.id || ""}
            onChange={(e) => setModel({ ...model, id: e.target.value })}
        />
    </FormField>)

}