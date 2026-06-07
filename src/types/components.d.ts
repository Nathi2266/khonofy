import type { ComponentType, ReactNode } from "react";

declare module "@/components/PageShell" {
  export interface PageShellProps {
    children?: ReactNode;
    className?: string;
  }

  export default function PageShell(props: PageShellProps): JSX.Element;
}

declare module "@/components/PageHeader" {
  export interface PageHeaderProps {
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
    iconSrc?: string;
    iconClassName?: string;
    className?: string;
  }

  export default function PageHeader(props: PageHeaderProps): JSX.Element;
}

declare module "@/components/SectionLoader" {
  export interface SectionLoaderProps {
    label?: string;
    className?: string;
    size?: string;
  }

  export default function SectionLoader(props: SectionLoaderProps): JSX.Element;
}

declare module "@/components/AuthLayout" {
  export interface AuthLayoutProps {
    icon?: ComponentType<{ className?: string }> | null;
    topImage?: string | null;
    topImageAlt?: string;
    topImageClassName?: string;
    title?: ReactNode;
    subtitle?: ReactNode;
    titleInCard?: boolean;
    titleClassName?: string;
    subtitleClassName?: string;
    footer?: ReactNode;
    afterCard?: ReactNode;
    children: ReactNode;
  }

  export default function AuthLayout(props: AuthLayoutProps): JSX.Element;
}

declare module "@/components/ui/checkbox" {
  import type * as React from "react";

  export interface CheckboxProps extends React.ComponentPropsWithoutRef<"button"> {
    checked?: boolean | "indeterminate";
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean | "indeterminate") => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    value?: string;
  }

  export const Checkbox: React.ForwardRefExoticComponent<
    CheckboxProps & React.RefAttributes<HTMLButtonElement>
  >;
}
