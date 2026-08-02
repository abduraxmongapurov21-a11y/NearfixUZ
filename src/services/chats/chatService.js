import { apiRequest } from "../api/client";
import { httpAuthRequest } from "../api/authenticatedClient";

function mapMedia(media) {
  if (!media) return null;

  return {
    id: media.id,
    url: media.url,
    mimeType: media.mimeType,
    fileName: media.fileName,
    size: media.size,
    scope: media.scope
  };
}

function resolveCounterpart(room, currentUserId) {
  if (!currentUserId) return null;
  return room.participants?.find((participant) => participant.userId !== currentUserId)?.user || null;
}

export function mapApiChatRoom(room, currentUserId) {
  const lastMessage = room.lastMessage || room.messages?.[0] || null;
  const counterpart = resolveCounterpart(room, currentUserId);

  return {
    id: room.id,
    source: "api",
    type: String(room.type || "ORDER").toLowerCase(),
    title: counterpart?.name || counterpart?.phone || room.title,
    cityId: room.cityId,
    serviceType: room.serviceType,
    orderId: room.orderId,
    participants: room.participants || [],
    participantCount: room.participants?.length || 0,
    unread: room.unreadCount || 0,
    subtitle: lastMessage?.body || (lastMessage?.media ? "Rasm" : "Xabar yo'q"),
    time: lastMessage?.createdAt ? new Date(lastMessage.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "",
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          body: lastMessage.body,
          type: String(lastMessage.type || "TEXT").toLowerCase(),
          media: mapMedia(lastMessage.media),
          senderName: lastMessage.sender?.name || lastMessage.sender?.phone || "NearFIX",
          createdAt: lastMessage.createdAt
        }
      : null
  };
}

export function mapApiChatMessage(message, currentUserId) {
  return {
    id: message.id,
    roomId: message.roomId,
    orderId: message.orderId,
    body: message.body,
    type: String(message.type || "TEXT").toLowerCase(),
    media: mapMedia(message.media),
    senderId: message.senderId,
    senderName: message.sender?.name || message.sender?.phone || "NearFIX",
    outgoing: message.senderId === currentUserId,
    readByOthers: Boolean(message.readByOthers),
    createdAt: message.createdAt
  };
}

export async function fetchChatRoomsApi(token, type, currentUserId) {
  return apiRequest(async () => {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    const payload = await httpAuthRequest(`/chats/rooms${query}`, { token });

    return {
      ok: true,
      rooms: (payload.rooms || []).map((room) => mapApiChatRoom(room, currentUserId))
    };
  });
}

export async function ensureOrderChatRoomApi(token, orderId, currentUserId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/chats/rooms/order/${orderId}`, {
      method: "POST",
      token
    });

    return {
      ok: true,
      room: mapApiChatRoom(payload.room, currentUserId)
    };
  });
}

export async function ensureWorkerChatRoomApi(token, workerId, currentUserId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/chats/rooms/worker/${workerId}`, {
      method: "POST",
      token
    });

    return {
      ok: true,
      room: mapApiChatRoom(payload.room, currentUserId)
    };
  });
}

export async function fetchChatMessagesApi(token, roomId, currentUserId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/chats/rooms/${roomId}/messages`, { token });

    return {
      ok: true,
      messages: (payload.messages || []).map((message) => mapApiChatMessage(message, currentUserId))
    };
  });
}

export async function sendChatMessageApi(token, roomId, message, currentUserId) {
  return apiRequest(async () => {
    const payload = await httpAuthRequest(`/chats/rooms/${roomId}/messages`, {
      method: "POST",
      token,
      body: message
    });

    return {
      ok: true,
      message: mapApiChatMessage(payload.message, currentUserId)
    };
  });
}

export async function markChatRoomReadApi(token, roomId) {
  return apiRequest(async () => {
    await httpAuthRequest(`/chats/rooms/${roomId}/read`, {
      method: "PATCH",
      token
    });

    return { ok: true };
  });
}
