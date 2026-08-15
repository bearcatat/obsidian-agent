import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"
import { t } from "@/i18n"

export const ModelName = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField
        label={t("settings:modelName")}
        required
    >
        <Input
            type="text"
            placeholder={t("settings:modelNamePlaceholder")}
            value={model.name}
            onChange={(e) => setModel({ ...model, name: e.target.value })}
        />
    </FormField>)

}
