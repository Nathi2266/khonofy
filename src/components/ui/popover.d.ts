import type * as React from "react";
import type * as PopoverPrimitive from "@radix-ui/react-popover";

export const Popover: typeof PopoverPrimitive.Root;
export const PopoverTrigger: typeof PopoverPrimitive.Trigger;
export const PopoverAnchor: typeof PopoverPrimitive.Anchor;

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {}

export const PopoverContent: React.ForwardRefExoticComponent<
  PopoverContentProps & React.RefAttributes<HTMLDivElement>
>;
