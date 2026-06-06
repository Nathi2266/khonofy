import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastViewportCenter,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();
  const centeredToasts = toasts.filter((toastItem) => toastItem.centered);
  const defaultToasts = toasts.filter((toastItem) => !toastItem.centered);

  const renderToast = ({ id, title, description, action, centered, onOpenChange, ...props }) => (
    <Toast key={id} centered={centered} onOpenChange={onOpenChange} {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose onClick={() => onOpenChange?.(false)} />
    </Toast>
  );

  return (
    <ToastProvider>
      <ToastViewport>
        {defaultToasts.map(renderToast)}
      </ToastViewport>
      <ToastViewportCenter>
        {centeredToasts.map(renderToast)}
      </ToastViewportCenter>
    </ToastProvider>
  );
}
