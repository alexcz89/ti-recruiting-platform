"use client";
import React, { useRef } from "react";
import { useRouter } from "next/navigation";
import { canStartReview } from "@/lib/hiring-process/start-review-eligibility";
import type { PresentationSource } from "@/lib/hiring-process/recruiting-presentation";
export default function CandidateProfileLink({ applicationId, jobId, source, enabled, href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    applicationId: string;
    jobId: string;
    source: PresentationSource;
    enabled: boolean;
}) {
    const router = useRouter();
    const pending = useRef(false);
    const command = useRef<{
        version: number;
        id: string;
    } | null>(null);
    const activate = (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
        // Modified, middle and external-target clicks use native navigation. A new tab
        // cannot reliably wait for the write without showing a blank page first.
        if (!enabled || !jobId || !canStartReview(source) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0 ||
            (event.currentTarget.target && event.currentTarget.target !== "_self"))
            return;
        event.preventDefault();
        if (pending.current)
            return;
        pending.current = true;
        if (!command.current || command.current.version !== source.stateVersion)
            command.current = { version: source.stateVersion, id: crypto.randomUUID() };
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 2000);
        void fetch(`/api/applications/${applicationId}/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({ intent: "START_REVIEW", expectedVersion: command.current.version, commandId: command.current.id }) })
            .catch(() => undefined).finally(() => {
            window.clearTimeout(timer);
            pending.current = false;
            router.push(href);
            router.refresh();
        });
    };
    return <a {...props} href={href} rel={props.target === "_blank" ? [props.rel, "noopener"].filter(Boolean).join(" ") : props.rel}
        onClick={activate} onAuxClick={activate}>{children}</a>;
}
