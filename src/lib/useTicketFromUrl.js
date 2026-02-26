"use client";

import { useEffect, useRef } from "react";

export default function useTicketFromUrl({ onTicket, onPr, onImages, onLabels }) {
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;

    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get("ticketId");
    if (!ticketId) return;

    fetched.current = true;

    (async () => {
      try {
        const res = await fetch("/api/jira/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticketId.trim() }),
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.ticketText && onTicket) onTicket(data.ticketText);
        if (data.prText && onPr) onPr(data.prText);
        if (data.imageAttachments?.length > 0 && onImages) onImages(data.imageAttachments);
        if (data.ticket?.labels && onLabels) onLabels(data.ticket.labels);
      } catch {
        // silently fail — user can manually fetch
      }
    })();
  }, [onTicket, onPr, onImages, onLabels]);
}
