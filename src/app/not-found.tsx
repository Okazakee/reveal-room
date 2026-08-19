"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { SealMark } from "@/components/SealMark";
import { getMessages, resolveUiLocale } from "@/lib/i18n";

export default function NotFound() {
  const t = getMessages(resolveUiLocale());
  return (
    <div className="wrap">
      <div className="status-screen">
        <SealMark variant="outline" size={40} />
        <h2>404</h2>
        <p>{t.errRoomNotFound}</p>
        <Link href="/">
          <Button variant="primary">{t.backHome}</Button>
        </Link>
      </div>
    </div>
  );
}
