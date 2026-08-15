import { ModelConfig } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Input } from "@/ui/elements/input"
import { t } from "@/i18n"

export const BaseUrl = ({ model, setModel }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}) => {
    return (<FormField label={t("settings:baseUrl")}>
        <Input
            type="text"
            placeholder={t("settings:baseUrlPlaceholder")}
            value={model.baseUrl}
            onChange={(e) => setModel({ ...model, baseUrl: e.target.value })}
        />
    </FormField>)

}
