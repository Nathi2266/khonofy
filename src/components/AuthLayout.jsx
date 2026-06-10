import React from "react";
import { cn } from "@/lib/utils";

export default function AuthLayout({
  icon: Icon,
  topImage,
  topImageAlt = "",
  topImageClassName = "w-28 sm:w-32",
  topImageInCard = false,
  title,
  subtitle,
  titleInCard = false,
  titleClassName = "",
  subtitleClassName = "",
  footer = null,
  afterCard = null,
  compact = false,
  children,
}) {
  const showTopImageAboveCard = topImage && !topImageInCard;
  const showTopImageInCard = topImage && topImageInCard;

  const topImageElement = topImage ? (
    <div className={cn("flex justify-center select-none", showTopImageInCard ? "mb-4" : "mb-5")}>
      <img
        src={topImage}
        alt={topImageAlt}
        className={cn("h-auto select-none pointer-events-none", topImageClassName)}
        draggable={false}
      />
    </div>
  ) : null;

  const cardHeader = (title || subtitle) ? (
    <div className={cn("text-center select-none", compact ? "mb-4" : "mb-6")}>
      {title ? (
        <h1
          className={cn(
            "font-bold tracking-tight text-foreground",
            titleInCard ? "text-xl sm:text-2xl" : "text-3xl",
            titleClassName
          )}
        >
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p
          className={cn(
            "text-muted-foreground",
            titleInCard ? "mt-2 text-xs sm:text-sm leading-relaxed" : "mt-2",
            subtitleClassName
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center px-4 py-6 overflow-hidden overscroll-none"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
        }
      }}
    >
      <div className="w-full max-w-md flex flex-col items-center">
        {showTopImageAboveCard ? topImageElement : null}

        {Icon ? (
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
        ) : null}

        {!titleInCard ? cardHeader : null}

        <div className="w-full overflow-hidden rounded-2xl shadow-sm border border-border">
          <div className={cn("bg-card", compact ? "p-6" : "p-8")}>
            {showTopImageInCard ? topImageElement : null}
            {titleInCard ? cardHeader : null}
            {children}
          </div>
          {afterCard}
        </div>

        {footer ? (
          <p className="text-center text-xs text-muted-foreground/80 mt-5 select-none">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}
