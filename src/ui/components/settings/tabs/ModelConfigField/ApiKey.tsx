import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { PasswordInput } from "@/ui/elements/password-input"
import { t } from "@/i18n"

export const ApiKey = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField label={t("settings:apiKey")}>
        <PasswordInput
            placeholder={t("settings:apiKeyPlaceholder")}
            value={model.apiKey || ""}
            onChange={(value) => setModel({ ...model, apiKey: value })}
        />
    </FormField>)

}
