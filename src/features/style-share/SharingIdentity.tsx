import { useState } from "react";

import ShareNameSheet from "./ShareNameSheet";
import {
  ensureSenderName,
  markSenderNameConfirmed,
  setSenderName,
} from "./shareStorage";
import "@/styles/modal.css";

/**
 * "Sharing as Jake · Change".
 *
 * A caption rather than a form field: the name is set once and then forgotten,
 * so it does not deserve a labelled input sitting above every style forever.
 * It is still shown, though, because most users never see the onboarding step
 * that asks for one — Pro users skip onboarding entirely, and so does anyone
 * who installed before sharing existed — and would otherwise have no idea they
 * were sending styles as "Nak Muay 4821".
 */
export default function SharingIdentity() {
  // Resolved on mount so an assigned name appears rather than a blank.
  const [name, setName] = useState(() => ensureSenderName());
  const [editing, setEditing] = useState(false);

  return (
    <>
      <p className="style-share-identity">
        Sharing as <strong>{name}</strong>
        <button type="button" onClick={() => setEditing(true)}>
          Change
        </button>
      </p>

      {editing && (
        <ShareNameSheet
          initialName={name}
          mode="edit"
          onCancel={() => setEditing(false)}
          onConfirm={(next) => {
            setSenderName(next);
            // Choosing it here counts as confirming, so the first share does
            // not stop to ask again.
            markSenderNameConfirmed();
            setName(next);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
