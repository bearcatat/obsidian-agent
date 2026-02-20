import { ModelConfig } from "@/types"
import { Checkbox } from "@/ui/elements/checkbox"
import { FormField } from "@/ui/elements/form-field"
import { Search } from "lucide-react"

interface WebSearchProps {
    model: ModelConfig
    setModel: (model: ModelConfig) => void
}

export const WebSearch = ({ model, setModel }: WebSearchProps) => {
    return (
        <FormField label="Web Search">
            <div className="tw-flex tw-items-center tw-gap-2">
                <Checkbox
                    checked={model.webSearchEnabled ?? false}
                    onCheckedChange={(checked) => 
                        setModel({ ...model, webSearchEnabled: checked === true })
                    }
                />
                <Search className="tw-size-4 tw-text-muted" />
                <span className="tw-text-sm tw-text-muted-foreground">
                    Enable Web Search for real-time information
                </span>
            </div>
        </FormField>
    )
}
