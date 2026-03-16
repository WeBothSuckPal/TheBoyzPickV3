import PusherServer from "pusher";
import PusherClient from "pusher-js";

export function getPusherServer() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  return new PusherServer({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });
}

export function getPusherClient() {
  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    return null;
  }

  return new PusherClient(key, {
    cluster,
  });
}

export async function dispatchPusherEvent(channel: string, event: string, data: unknown) {
  const pusher = getPusherServer();
  if (pusher) {
    try {
      await pusher.trigger(channel, event, data);
    } catch (e) {
      console.error("[pusher] fetch error:", e);
    }
  }
}
