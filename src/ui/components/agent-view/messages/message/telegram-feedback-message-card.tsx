import { TelegramFeedbackProgress, TelegramFeedbackReply, TelegramFeedbackStatus } from "@/types";
import { Button } from "@/ui/elements/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/ui/elements/collapsible";
import { ChevronsUpDown } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { formatDateTime, t } from "../../../../../i18n";

export interface TelegramFeedbackMessageCardData extends TelegramFeedbackProgress {}

type Props = TelegramFeedbackMessageCardData;

export const TelegramFeedbackMessageCard = memo(({ question, replies, status, imageCount, imageAnalysis, username }: Props) => {
  const isActive = status === "pending" || status === "processing";
  const [isOpen, setIsOpen] = useState(isActive);

  useEffect(() => {
    setIsOpen(isActive);
  }, [isActive]);

  const header = useMemo(() => getHeaderText(status), [status]);
  const summary = useMemo(() => getSummaryText(replies.length, imageCount), [replies.length, imageCount]);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="tw-flex-col tw-group tw-flex tw-rounded-md tw-p-1 tw-border tw-border-solid tw-border-border"
    >
      <div className="tw-flex tw-items-center tw-justify-between tw-px-1 tw-text-sm">
        <div className="tw-min-w-0 tw-truncate tw-text-muted tw-text-xs">
          {t('agent:telegramFeedback')} {header} {username ? `from @${username}` : ""} {!isOpen && summary ? summary : ""}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <ChevronsUpDown className="tw-size-4" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="tw-text-muted tw-gap-1 tw-px-1 tw-rounded-sm tw-bg-primary tw-max-h-64 tw-overflow-y-auto">
        <Section title={t('common:question')}>
          <TextBlock text={question} muted={false} />
        </Section>

        {replies.length > 0 ? (
          <Section title={t('common:replies')}>
            <div className="tw-flex tw-flex-col tw-gap-2">
              {replies.map((reply, index) => (
                <ReplyCard key={`${reply.messageId}-${index}`} reply={reply} index={index} />
              ))}
            </div>
          </Section>
        ) : (
          <Section title={t('common:replies')}>
            <TextBlock text={t('agent:waitingTelegramReply')} muted />
          </Section>
        )}

        {status === "processing" || imageAnalysis ? (
          <Section title={t('common:imageAnalysis')}>
            <TextBlock text={imageAnalysis || t('agent:receivedProcessingImagesText')} muted={!imageAnalysis} />
          </Section>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
});

TelegramFeedbackMessageCard.displayName = "TelegramFeedbackMessageCard";

export function renderTelegramFeedbackMessage(data: TelegramFeedbackMessageCardData): React.ReactNode {
  return <TelegramFeedbackMessageCard {...data} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="tw-flex tw-flex-col tw-gap-1 tw-py-1">
      <div className="tw-px-1 tw-text-[11px] tw-uppercase tw-tracking-wide tw-text-muted">{title}</div>
      {children}
    </div>
  );
}

function ReplyCard({ reply, index }: { reply: TelegramFeedbackReply; index: number }) {
  const images = reply.images ?? [];
  const hasText = reply.text.trim().length > 0;

  return (
    <div className="tw-flex tw-flex-col tw-gap-2 tw-rounded-md tw-border tw-border-solid tw-border-border tw-bg-background tw-p-1.5">
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-2 tw-px-1 tw-text-[11px] tw-text-muted">
        <span>{t('common:replyNumber', { number: index + 1 })}</span>
        <span>{formatTimestamp(reply.receivedAt)}</span>
      </div>
      {images.length > 0 ? (
        <div className="tw-grid tw-grid-cols-2 tw-gap-1.5 tw-px-1">
          {images.map((image, imageIndex) => (
            <img
              key={`${reply.messageId}-${imageIndex}`}
              src={image}
              alt={t('agent:telegramFeedbackImage', { number: imageIndex + 1 })}
              className="tw-h-28 tw-w-full tw-rounded-md tw-object-cover tw-border tw-border-solid tw-border-border tw-bg-muted"
            />
          ))}
        </div>
      ) : null}
      {hasText ? <TextBlock text={reply.text} muted={false} /> : null}
      {!hasText && images.length === 0 ? <TextBlock text={t('agent:emptyReply')} muted /> : null}
    </div>
  );
}

function TextBlock({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <div
      className={[
        "tw-rounded-md tw-border tw-border-solid tw-border-border tw-bg-background tw-p-1.5 tw-text-xs tw-whitespace-pre-wrap tw-break-words",
        muted ? "tw-text-muted" : "tw-text-normal",
      ].join(" ")}
    >
      {text}
    </div>
  );
}

function getHeaderText(status: TelegramFeedbackStatus): string {
  switch (status) {
    case "processing":
      return t('agent:receivedProcessingImages');
    case "completed":
    case "received":
      return t('agent:received');
    default:
      return t('agent:pending');
  }
}

function getSummaryText(replyCount: number, imageCount: number): string {
  const parts: string[] = [];
  if (replyCount > 0) {
    parts.push(t('agent:replyCount', { count: replyCount }));
  }
  if (imageCount > 0) {
    parts.push(t('agent:imageCount', { count: imageCount }));
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
}

function formatTimestamp(value: number): string {
  try {
    return formatDateTime(value, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return "";
  }
}
