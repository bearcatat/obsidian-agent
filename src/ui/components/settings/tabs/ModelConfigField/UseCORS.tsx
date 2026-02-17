import { ModelConfig } from "@/types"
import { Checkbox } from "@/ui/elements/checkbox"
import { FormField } from "@/ui/elements/form-field"

interface UseCORSProps {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}

export const UseCORS = ({ model, setModel }: UseCORSProps) => {
    return (
        <FormField label="Use CORS Proxy">
            <div className="tw-flex tw-items-center tw-gap-2">
                <Checkbox
                    checked={model.useCORS ?? false}
                    onCheckedChange={(checked) => 
                        setModel({ ...model, useCORS: checked === true })
                    }
                />
                <span className="tw-text-sm tw-text-muted-foreground">
                    Enable to bypass browser CORS restrictions
                </span>
            </div>
        </FormField>
    )
}
