import type * as React from "react";
import type { Command as CommandPrimitive } from "cmdk";
import type { DialogProps } from "@radix-ui/react-dialog";

export interface CommandProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive> {}

export const Command: React.ForwardRefExoticComponent<
  CommandProps & React.RefAttributes<HTMLDivElement>
>;

export interface CommandDialogProps extends DialogProps {
  children?: React.ReactNode;
}

export const CommandDialog: React.ComponentType<CommandDialogProps>;

export const CommandInput: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & React.RefAttributes<HTMLInputElement>
>;

export const CommandList: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> & React.RefAttributes<HTMLDivElement>
>;

export const CommandEmpty: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> & React.RefAttributes<HTMLDivElement>
>;

export const CommandGroup: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> & React.RefAttributes<HTMLDivElement>
>;

export const CommandSeparator: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator> & React.RefAttributes<HTMLDivElement>
>;

export const CommandItem: React.ForwardRefExoticComponent<
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & React.RefAttributes<HTMLDivElement>
>;

export const CommandShortcut: React.ComponentType<React.HTMLAttributes<HTMLSpanElement>>;
