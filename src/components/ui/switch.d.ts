import type * as React from "react";
import type * as SwitchPrimitives from "@radix-ui/react-switch";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {}

export const Switch: React.ForwardRefExoticComponent<
  SwitchProps & React.RefAttributes<HTMLButtonElement>
>;
