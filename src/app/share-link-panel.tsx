"use client";

import { useState } from "react";

interface ShareLinkPanelProps {
  title: string;
  buttonLabel: string;
  path: string | null;
  disclosure: string;
}

export function ShareLinkPanel({
  title,
  buttonLabel,
  path,
  disclosure,
}: ShareLinkPanelProps) {
  const [feedback, setFeedback] = useState<{
    status: "success" | "failure";
    message: string;
  } | null>(null);
  const [manualLink, setManualLink] = useState("");

  async function copyLink() {
    if (!path) {
      setFeedback({
        status: "failure",
        message:
          "These values could not be validated. Review the form and try again.",
      });
      return;
    }
    const url = new URL(path, window.location.origin).toString();
    let fallbackAttempted = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackAttempted = true;
        if (!copyWithDocumentCommand(url))
          throw new Error("Clipboard unavailable");
      }
      setFeedback({ status: "success", message: "Link copied." });
      setManualLink("");
    } catch {
      if (!fallbackAttempted && copyWithDocumentCommand(url)) {
        setFeedback({ status: "success", message: "Link copied." });
        setManualLink("");
      } else {
        setFeedback({
          status: "failure",
          message: "Copy failed. Select and copy the link below.",
        });
        setManualLink(url);
      }
    }
  }

  return (
    <section className="share-comparison" aria-labelledby="share-link-heading">
      <h2 id="share-link-heading">{title}</h2>
      <p>{disclosure}</p>
      <button type="button" onClick={copyLink}>
        {buttonLabel}
      </button>
      {feedback && (
        <p role={feedback.status === "success" ? "status" : "alert"}>
          {feedback.message}
        </p>
      )}
      {manualLink && (
        <div className="field">
          <label htmlFor="manual-share-link">Share link</label>
          <input
            id="manual-share-link"
            type="url"
            readOnly
            value={manualLink}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </section>
  );
}

function copyWithDocumentCommand(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
