import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"
import { t } from "@/i18n"

export const DisplayName = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField
        label={t("settings:displayName")}
        required
    >
        <Input
            type="text"
            placeholder={t("settings:modelIdPlaceholder")}
            value={model.id || ""}
            onChange={(e) => setModel({ ...model, id: e.target.value })}
        />
    </FormField>)

}
