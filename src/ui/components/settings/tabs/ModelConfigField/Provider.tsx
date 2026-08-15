import { ModelConfig, ModelProviders } from "@/types"
import { FormField } from "@/ui/elements/form-field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/select"
import { t } from "@/i18n"

export const Provider = ({ model, setModel, dialogElement }: {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
    dialogElement: HTMLDivElement | null
}) => {
    return (<FormField label={t("settings:provider")}>
        <Select value={model.provider} onValueChange={(value) => setModel({ ...model, provider: value })}>
            <SelectTrigger>
                <SelectValue placeholder={t("common:selectProvider")} />
            </SelectTrigger>
            <SelectContent container={dialogElement}>
                {Object.values(ModelProviders).map((provider) => (
                    <SelectItem key={provider} value={provider}>
                        {provider}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </FormField>)

}
