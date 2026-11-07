import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { schoolInfo } from "@/lib/school-info";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

const instructions = `You are the friendly admissions assistant for ${schoolInfo.name}.
Answer prospective families' questions ONLY using the published school information below.
If the answer isn't in it (e.g. exact fees, transport), say you don't have that detail and direct them to the admissions office contact.
Keep answers short (under 120 words), warm and clear. Use markdown lists when helpful.

SCHOOL INFORMATION (JSON):
${JSON.stringify(schoolInfo, null, 2)}`;

export async function handleAsk(request: Request) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return Response.json({ error: "AI is not configured." }, { status: 500 });

  let messages: UIMessage[];
  try {
    ({ messages } = (await request.json()) as { messages: UIMessage[] });
    if (!Array.isArray(messages) || messages.length > 40) throw new Error();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      onError: (e) => {
        const status = (e as { statusCode?: number })?.statusCode;
        if (status === 429)
          return "We're getting lots of questions — please try again in a moment.";
        if (status === 402)
          return "The assistant is temporarily unavailable. Please contact admissions.";
        return "Sorry, something went wrong. Please try again.";
      },
    }),
    runIdFetch,
  );
}
