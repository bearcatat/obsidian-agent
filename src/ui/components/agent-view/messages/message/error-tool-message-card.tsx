import { MessageCard } from "./message-card";

type Props = {
  content: string;
  errorDetails?: Record<string, any>;
  errorType?: string;
};

export const ErrorToolMessageCard = ({ 
  content, 
  errorDetails, 
  errorType 
}: Props) => {
  const getErrorTypeLabel = (type?: string) => {
    switch (type) {
      case "validation": return "验证错误";
      case "runtime": return "运行时错误";
      case "permission": return "权限错误";
      case "network": return "网络错误";
      case "configuration": return "配置错误";
      case "not_found": return "资源不存在";
      default: return "工具错误";
    }
  };

  const getErrorTypeColor = (type?: string) => {
    switch (type) {
      case "validation": return "tw-bg-warning/10 tw-border-warning";
      case "permission": return "tw-bg-error/10 tw-border-error";
      case "configuration": return "tw-bg-warning/10 tw-border-warning";
      default: return "tw-bg-error/10 tw-border-error";
    }
  };

  return (
    <MessageCard has_border={true}>
      <div className="tw-flex tw-flex-col tw-gap-2">
        <div className="tw-flex tw-items-start tw-gap-2">
          <div className="tw-text-error tw-text-lg">⚠️</div>
          <div className="tw-flex-1">
            <div className="tw-font-medium tw-text-error">{content}</div>
            {errorType && (
              <div className={`tw-inline-block tw-px-2 tw-py-0.5 tw-rounded tw-text-xs tw-mt-1 ${getErrorTypeColor(errorType)}`}>
                {getErrorTypeLabel(errorType)}
              </div>
            )}
          </div>
        </div>
        
        {errorDetails && Object.keys(errorDetails).length > 0 && (
          <div className="tw-mt-2 tw-border tw-border-muted tw-rounded tw-p-2 tw-bg-muted/10">
            <div className="tw-text-xs tw-text-muted tw-font-medium tw-mb-1">错误详情:</div>
            <pre className="tw-text-xs tw-overflow-auto tw-max-h-40 tw-whitespace-pre-wrap">
              {JSON.stringify(errorDetails, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </MessageCard>
  );
};