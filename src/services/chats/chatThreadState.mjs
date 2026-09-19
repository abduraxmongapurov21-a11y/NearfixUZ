import { mergeChatMessages } from "./chatSync.mjs";

// One instance per account/mode/room. Transport functions return mapped API data.
export function createChatThreadState({ load, markRead, onRead, onChange, isCurrent, isActive }) {
  let alive = true;
  let messages = [];
  let sending = false;
  let revision = 0;
  let sequence = 0;
  let visible = null;
  let readThrough = null;
  let reading = false;
  const current = () => alive && isCurrent();
  const active = () => current() && isActive();
  const emit = () => { if (current()) onChange({ messages, sending }); };

  async function readVisible() {
    if (!active() || reading || !visible || visible.id === readThrough) return;
    const boundary = visible;
    reading = true;
    let succeeded = false;
    try {
      const result = await markRead(boundary.id);
      if (current() && result.ok) {
        readThrough = boundary.id;
        succeeded = true;
        if (active()) await onRead({ isCurrent: active });
      }
    } finally {
      reading = false;
    }
    if (succeeded && visible?.id !== boundary.id) void readVisible();
  }

  return {
    async refresh({ isCurrent: requestCurrent = active } = {}) {
      if (!active() || sending) return;
      const ticket = revision;
      const result = await load();
      if (!active() || !requestCurrent() || ticket !== revision || !result.ok) return;
      messages = mergeChatMessages(messages, result.messages);
      emit();
      await readVisible();
    },
    setVisible(ids) {
      if (!active()) return;
      const displayed = messages.filter((message) => ids.includes(message.id) && !message.status);
      const latest = displayed.at(-1);
      if (latest && (!visible || latest.createdAt >= visible.createdAt)) visible = latest;
      void readVisible();
    },
    async send(draft, deliver) {
      if (!current() || sending) return { ok: false };
      sending = true;
      revision += 1; // Discard reads begun before the mutation.
      const pendingId = `pending-${++sequence}`;
      messages = mergeChatMessages(messages, [{ ...draft, id: pendingId, createdAt: new Date().toISOString(), outgoing: true, status: "sending" }]);
      emit();
      let result;
      try { result = await deliver(); } catch (error) { result = { ok: false, message: error?.message }; }
      if (!current()) return result;
      messages = result.ok
        ? mergeChatMessages(messages, [result.message], pendingId)
        // An acknowledgement can be lost after commit. Drop the temporary row
        // on failure so a later canonical poll cannot leave a duplicate bubble.
        : messages.filter((message) => message.id !== pendingId);
      sending = false;
      revision += 1;
      emit();
      return result;
    },
    dispose() { alive = false; revision += 1; }
  };
}
