import { NextResponse } from "next/server";
import { verifyBachsWebhookSignature } from "@/lib/bachs";
import { settleBachsPayment } from "@/lib/payment-settlement";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-bachs-signature");
    const timestamp = request.headers.get("x-bachs-timestamp");

    if (!verifyBachsWebhookSignature(rawBody, signature, timestamp)) {
      return NextResponse.json({ error: "Invalid Bachs webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        object?: {
          id?: string;
          metadata?: { reference?: string };
        };
      };
    };

    if (event.type !== "checkout.completed" && event.type !== "collection.succeeded") {
      return NextResponse.json({ received: true, ignored: event.type });
    }

    const obj = event.data?.object;
    const refOrId = obj?.metadata?.reference || obj?.id;
    if (!refOrId) {
      return NextResponse.json({ error: "Missing checkout session reference" }, { status: 400 });
    }

    const result = await settleBachsPayment(refOrId, "webhook");
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bachs webhook processing failed" },
      { status: 500 }
    );
  }
}
