import { NextRequest, NextResponse } from "next/server";

// Farcaster Mini App Webhook Handler
// Handles events sent by the Farcaster protocol to our app
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event } = body;

    // Log the event for debugging
    console.log("[Farcaster Webhook] Event received:", event, body);

    switch (event) {
      case "frame_added":
        // User added the mini app — could trigger welcome notification
        console.log("[Farcaster Webhook] App added by user:", body.fid);
        break;

      case "frame_removed":
        // User removed the mini app
        console.log("[Farcaster Webhook] App removed by user:", body.fid);
        break;

      case "notifications_enabled":
        // User enabled notifications
        console.log("[Farcaster Webhook] Notifications enabled by:", body.fid);
        break;

      case "notifications_disabled":
        // User disabled notifications
        console.log("[Farcaster Webhook] Notifications disabled by:", body.fid);
        break;

      default:
        console.log("[Farcaster Webhook] Unknown event:", event);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[Farcaster Webhook] Error:", err);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// Farcaster may also send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
