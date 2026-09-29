import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

import { trackEvent } from "@/utils/analytics";
import {
  SHARE_LIMITS,
  buildShareUrl,
  encodeStyleCode,
} from "@/utils/styleShare";
import type { TechniqueShape } from "@/utils/techniqueUtils";

export type ShareOutcome =
  /** The OS share sheet opened. Whether they actually sent it is not ours to know. */
  | { status: "shared"; url: string }
  /** No share sheet available, so the link went to the clipboard instead. */
  | { status: "copied"; url: string }
  /** The user backed out of the share sheet. Not an error, and not worth a message. */
  | { status: "cancelled" }
  | { status: "failed"; url?: string };

/** A filesystem-safe stem for the card, derived from the style's name. */
const cardFileBase = (title: string): string =>
  `shotcaller-style-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "share"}`;

/**
 * Park the card in the cache directory and hand back a URI the share sheet can
 * read.
 *
 * The filename carries a timestamp because Android keys share-sheet previews
 * on the content URI and keeps them — reusing a path means the sheet shows a
 * thumbnail of the *previous* style while attaching the current bytes. The
 * same trap was found and fixed for the challenge card.
 */
const writeCardToCache = async (
  card: Blob,
  title: string
): Promise<string | null> => {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(String(reader.result).replace(/^data:image\/png;base64,/, ""));
      reader.onerror = reject;
      reader.readAsDataURL(card);
    });

    const result = await Filesystem.writeFile({
      path: `${cardFileBase(title)}-${Date.now()}.png`,
      data: base64,
      directory: Directory.Cache,
    });
    return result.uri;
  } catch {
    // A card is a nicety; the link is the payload. Never fail a share over it.
    return null;
  }
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * `Share.share` rejects when the user dismisses the sheet, which is not a
 * failure. iOS and Android word it differently and neither is a stable API, so
 * this matches loosely and treats anything unrecognised as a real error.
 */
const isDismissal = (error: unknown): boolean => {
  const message = String((error as Error)?.message ?? error).toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("abort") ||
    message.includes("dismiss")
  );
};

/**
 * Hand one custom style to the OS share sheet as a link.
 *
 * The style travels inside the link, so there is nothing to upload and nothing
 * that can rot: the message the friend receives is the style. See
 * {@link encodeStyleCode} for why the payload sits in the fragment.
 */
export const shareStyle = async (
  group: TechniqueShape,
  senderName: string,
  /**
   * The card image to send alongside the link. Optional: a failed capture
   * degrades to a text-only share rather than losing the style.
   */
  card?: Blob | null
): Promise<ShareOutcome> => {
  let url: string;
  try {
    url = buildShareUrl(await encodeStyleCode(group, senderName));
  } catch {
    return { status: "failed" };
  }

  const title = group.title ?? group.label ?? "a style";
  const who = senderName.trim();
  const intro = who
    ? `${who} shared a Muay Thai style with you: "${title}"`
    : `Someone shared a Muay Thai style with you: "${title}"`;
  // With an image attached the URL has to live inside the text: the native
  // share's `url` slot is taken by the file, and web targets routinely drop a
  // separate `url` when files are present. Without one, `url` stays its own
  // field so targets that render link previews still get a bare link.
  const text = card ? `${intro}\n${url}` : intro;

  trackEvent("style_share_created", {
    // Never the style's name or its techniques — that is the user's content and
    // it has no business in an analytics payload.
    link_chars: url.length,
    singles: group.singles?.length ?? 0,
    combos: group.combos?.length ?? 0,
    oversized: url.length > SHARE_LIMITS.linkSoftMax,
    with_card: !!card,
    platform: Capacitor.getPlatform(),
  });

  // Native first: this is the path that matters, and Capacitor's Share plugin
  // is the real OS sheet on both platforms.
  if (Capacitor.isNativePlatform()) {
    try {
      const fileUri = card ? await writeCardToCache(card, title) : null;
      await Share.share({
        title: `${title} — Shot Caller`,
        text,
        // `files` is the plugin's parameter for an attachment; a file:// in
        // `url` lands in the same place but reads like a link. Either way the
        // share is ONE intent (Android: EXTRA_TEXT + EXTRA_STREAM) or one
        // activity item list (iOS), so a messaging app renders it as a single
        // message with the image above its caption. Two separate messages is
        // a desktop `navigator.share` behaviour, not this path.
        ...(fileUri ? { files: [fileUri] } : { url }),
        dialogTitle: "Share this style",
      });
      return { status: "shared", url };
    } catch (error) {
      if (isDismissal(error)) return { status: "cancelled" };
      return (await copyToClipboard(url))
        ? { status: "copied", url }
        : { status: "failed", url };
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      const file = card
        ? new File([card], `${cardFileBase(title)}.png`, { type: "image/png" })
        : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${title} — Shot Caller`,
          text,
          files: [file],
        });
      } else {
        await navigator.share({ title: `${title} — Shot Caller`, text, url });
      }
      return { status: "shared", url };
    } catch (error) {
      // A cancelled Web Share rejects with AbortError.
      if ((error as Error)?.name === "AbortError") return { status: "cancelled" };
    }
  }

  return (await copyToClipboard(url))
    ? { status: "copied", url }
    : { status: "failed", url };
};
