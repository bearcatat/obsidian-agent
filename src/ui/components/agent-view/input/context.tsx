import { Badge } from "@/ui/elements/badge";
import { Button } from "@/ui/elements/button";
import { X } from "lucide-react";
import React from "react";
import { Context } from "@/types";

function ContextImageBadge({
  image,
  index,
  removeImage,
}: {
  image: string;
  index: number;
  removeImage: (index: number) => void;
}) {
  return (
    <Badge className="tw-items-center tw-py-0 tw-pl-0.5 tw-pr-0.5 tw-text-xs tw-gap-1">
      <img
        src={image}
        alt={`Pasted image ${index + 1}`}
        className="tw-w-6 tw-h-6 tw-object-cover tw-rounded"
      />
      <Button
        variant="ghost2"
        size="fit"
        onClick={() => removeImage(index)}
        aria-label="Remove image from context"
      >
        <X className="tw-size-4" />
      </Button>
    </Badge>
  );
}

export const InputContext = ({
  context,
  removeImage
}: {
  context: Context
  removeImage?: (index: number) => void;
}) => {
  const images = React.useMemo(() => {
    return context.images ?? [];
  }, [context]);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="tw-flex tw-w-full tw-items-center tw-gap-1 tw-px-1">
      <div className="tw-flex tw-flex-1 tw-flex-wrap tw-gap-1">
        {images.map((image, index) => (
          <ContextImageBadge
            key={`${index}-${image.slice(0, 20)}`}
            image={image}
            index={index}
            removeImage={removeImage || (() => {})}
          />
        ))}
      </div>
    </div>
  );
};
