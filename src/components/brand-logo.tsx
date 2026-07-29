"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";

/** Canonical logo asset — same file everywhere (header, footer, chat, favicons). */
export const BRAND_LOGO_SRC = "/marketing/logo.png";

type Props =
  | { variant: "header"; className?: string }
  | { variant: "footer"; className?: string }
  | { variant: "drawer"; className?: string };

/**
 * Displays the Dawasarthi mark. Image is generated via `npm run generate:logo`
 * (writes `public/marketing/logo.png` through OpenRouter). If missing, only the
 * wordmark shows after `next/image` fails.
 */
export function BrandLogo(props: Props) {
  const [hideImage, setHideImage] = useState(false);

  const onLogoError = useCallback(() => {
    setHideImage(true);
  }, []);

  const dims =
    props.variant === "footer"
      ? {
          w: 80,
          h: 80,
          imgClass:
            "h-[4.5rem] w-[4.5rem] shrink-0 object-contain sm:h-20 sm:w-20",
        }
      : props.variant === "drawer"
        ? { w: 40, h: 40, imgClass: "h-10 w-10 shrink-0 object-contain" }
        : {
            w: 52,
            h: 52,
            imgClass:
              "h-7 w-7 shrink-0 object-contain sm:h-9 sm:w-9 lg:h-10 lg:w-10",
          };

  const logoMark = !hideImage && (
    <Image
      src={BRAND_LOGO_SRC}
      alt="Dawasarthi"
      width={dims.w}
      height={dims.h}
      className={dims.imgClass}
      priority={props.variant === "header"}
      onError={onLogoError}
    />
  );

  if (props.variant === "footer") {
    return (
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-start ${props.className ?? ""}`}
      >
        {logoMark}
        <div>
          <p className="text-2xl font-bold tracking-tight text-slate-950">
            Dawasarthi
          </p>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
            30-minute medicine delivery in Dibiyapur. Trusted pricing,
            prescription handling, and 24×7 support.
          </p>
        </div>
      </div>
    );
  }

  const textBlock =
    props.variant === "drawer" ? (
      <>
        <p className="text-sm font-bold leading-tight text-slate-950">Dawasarthi</p>
        <p className="text-xs leading-tight text-muted-foreground">
          Dibiyapur · 30 min delivery
        </p>
      </>
    ) : (
      <>
        <p className="text-[11px] font-bold leading-none tracking-tight text-slate-950 sm:text-xs">
          Dawasarthi
        </p>
        <p className="hidden leading-none text-muted-foreground sm:block sm:text-[8px]">
          Dibiyapur · 30 min delivery
        </p>
      </>
    );

  const row = (
    <span
      className={
        props.variant === "drawer"
          ? "flex items-center gap-2.5"
          : "flex items-center gap-1.5 sm:gap-2"
      }
    >
      {logoMark}
      <span className="min-w-0 text-left">{textBlock}</span>
    </span>
  );

  if (props.variant === "drawer") {
    return <div className={props.className}>{row}</div>;
  }

  return (
    <Link href="/" className={`shrink-0 ${props.className ?? ""}`}>
      {row}
    </Link>
  );
}
