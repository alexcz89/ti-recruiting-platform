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
        if (!enabled || !jobId || !canStartReview(source) || event.altKey || (event.button !== 0 && event.button !== 1))
            return;
        event.preventDefault();
        if (pending.current)
            return;
        const newTab = event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey || props.target === "_blank";
        const tab = newTab ? window.open("about:blank", "_blank") : null;
        if (tab)
            tab.opener = null;
        if (newTab && !tab) {
            window.location.assign(href);
            return;
        }
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
            if (tab)
                tab.location.href = href;
            else {
                router.push(href);
                router.refresh();
            }
        });
    };
    return <a {...props} href={href} onClick={activate} onAuxClick={activate}>{children}</a>;
}
