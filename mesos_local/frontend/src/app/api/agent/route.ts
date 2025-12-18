import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { message, tenantId, tenantName } = await request.json();
        const token = process.env.GROQ_API_KEY;

        if (!token) {
            return NextResponse.json(
                { error: "Server Configuration Error: Missing GROQ_API_KEY" },
                { status: 500 }
            );
        }

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // Audit log for multi-tenant tracking
        console.log(`[AGENT] Tenant: ${tenantId?.slice(0, 8) || "anonymous"}... | Message: "${message.slice(0, 50)}..."`);

        // Multi-tenant aware prompt
        // The LLM only knows about THIS tenant's context
        const tenantContext = tenantId
            ? `You are the Dispatcher Agent for business "${tenantName || "Unknown Business"}". 
               Their wallet/tenant ID is: ${tenantId}.
               You only have access to THIS business's data. Never reference other tenants.`
            : "You are a general Dispatcher Agent.";

        const prompt = `${tenantContext}

You are a financial transaction parser. Extract transaction details from requests.
Request: "${message}"

Tasks you can handle:
1. PAYMENT: "Pay X to [address]" → Extract amount and address
2. BALANCE: "What's my balance?" → Return { "intent": "balance" }
3. MERCHANTS: "Who can I pay?" → Return { "intent": "merchants" }
4. YIELD: "Treasury status" → Return { "intent": "yield" }

For PAYMENT, return JSON: { "amount": "number", "address": "string" }
For other intents, return JSON: { "intent": "balance|merchants|yield" }
If unclear, return: { "intent": "unknown", "message": "brief clarification request" }

Output ONLY raw JSON. No markdown, no explanation.`;

        const response = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 500,
                    temperature: 0.1,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("HF API Error:", errorText);
            // Handle "model loading" state which is common with HF Inference API
            if (errorText.includes("currently loading")) {
                return NextResponse.json({ error: "Model is waking up. Please try again in 30s." }, { status: 503 });
            }
            return NextResponse.json({ error: "Upstream AI Error", details: errorText }, { status: 502 });
        }

        const result = await response.json();
        const generatedText = result.choices?.[0]?.message?.content || "";

        console.log("HF Output:", generatedText);

        // Heuristic Parsing of the output
        // Flan-T5 might return: "{ 'amount': 50, 'address': '...' }" or just the text.
        // We try to find JSON, otherwise we fall back to regex on the INPUT (safe fallback).

        let parsedData = {};
        try {
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedData = JSON.parse(jsonMatch[0]);
            } else {
                // If AI failed to output strictly JSON, we resort to regex on the original input
                // but we return the AI's "thought" as a debug string if needed.
                throw new Error("No JSON found");
            }
        } catch (e) {
            // Fallback: The API call succeeded but parsing failed.
            // We return a special flag so frontend can use its regex backup.
            return NextResponse.json({
                ai_raw: generatedText,
                fallback: true
            });
        }

        return NextResponse.json(parsedData);

    } catch (error) {
        console.error("Agent Route Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
