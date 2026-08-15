import { ModelConfig } from "@/types"
import { Checkbox } from "@/ui/elements/checkbox"
import { FormField } from "@/ui/elements/form-field"
import { t } from "@/i18n"

interface UseCORSProps {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}

export const UseCORS = ({ model, setModel }: UseCORSProps) => {
    return (
        <FormField label={t("settings:useCorsProxy")}>
            <div className="tw-flex tw-items-center tw-gap-2">
                <Checkbox
                    checked={model.useCORS ?? false}
                    onCheckedChange={(checked) => 
                        setModel({ ...model, useCORS: checked === true })
                    }
                />
                <span className="tw-text-sm tw-text-muted-foreground">
                    {t("settings:useCorsProxyHelp")}
                </span>
            </div>
        </FormField>
    )
}
