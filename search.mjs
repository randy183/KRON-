export default async (req) => {

    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({
                error: "Method not allowed"
            }),
            {
                status: 405,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }

    try {

        const body = await req.json();

        const subject =
            String(body.subject || "").trim();

        const question =
            String(body.question || "").trim();

        if (!subject || !question) {
            return new Response(
                JSON.stringify({
                    error:
                        "Subject and question are required."
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        // =========================
        // 1. SEARCH THE WEB
        // =========================

        const searchQuery =
            subject +
            " " +
            question +
            " WAEC Nigeria";

        const searchUrl =
            "https://freeserp.ai/api.php" +
            "?index=web" +
            "&q=" +
            encodeURIComponent(searchQuery) +
            "&size=8";

        const searchResponse =
            await fetch(searchUrl);

        if (!searchResponse.ok) {
            return new Response(
                JSON.stringify({
                    error:
                        "FreeSerp web search failed."
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        const searchData =
            await searchResponse.json();

        const rawResults =
            searchData.results ||
            searchData.web ||
            [];

        const results =
            rawResults.map(function(item) {

                return {
                    title:
                        item.title || "",

                    snippet:
                        item.snippet ||
                        item.description ||
                        "",

                    url:
                        item.url || ""
                };

            });

        // =========================
        // 2. GET OPENROUTER KEY
        // =========================

        const apiKey =
            process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return new Response(
                JSON.stringify({
                    error:
                        "OpenRouter API key is missing."
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        // =========================
        // 3. PREPARE WEB RESULTS
        // =========================

        const sourceText =
            results
                .map(function(item, index) {

                    return (
                        (index + 1) +
                        ". " +
                        item.title +
                        "\n" +
                        item.snippet +
                        "\n" +
                        item.url
                    );

                })
                .join("\n\n");

        // =========================
        // 4. ASK OPENROUTER
        // =========================

        const aiResponse =
            await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            "Bearer " + apiKey,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        model:
                            "openai/gpt-oss-20b:free",

                        messages: [

                            {
                                role: "system",

                                content:
                                    "You are KRON Study AI, a helpful Nigerian secondary-school study assistant. " +
                                    "Use the supplied web search results to answer the student's question accurately. " +
                                    "Explain concepts clearly and simply. " +
                                    "Do not invent information when the sources do not provide enough evidence."
                            },

                            {
                                role: "user",

                                content:
                                    "Subject: " +
                                    subject +
                                    "\n\nQuestion: " +
                                    question +
                                    "\n\nWeb search results:\n" +
                                    sourceText
                            }

                        ]

                    })
                }
            );

        if (!aiResponse.ok) {

            const errorText =
                await aiResponse.text();

            return new Response(
                JSON.stringify({
                    error:
                        "OpenRouter request failed.",

                    details:
                        errorText
                }),
                {
                    status: 502,
                    headers: {
                        "Content-Type":
                            "application/json"
                    }
                }
            );
        }

        // =========================
        // 5. GET AI ANSWER
        // =========================

        const aiData =
            await aiResponse.json();

        const answer =
            aiData.choices?.[0]?.message?.content ||
            "KRON could not generate an answer.";

        // =========================
        // 6. SEND BACK TO KRON
        // =========================

        return new Response(
            JSON.stringify({

                subject:
                    subject,

                question:
                    question,

                answer:
                    answer,

                results:
                    results

            }),
            {
                status: 200,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    } catch (error) {

        return new Response(
            JSON.stringify({

                error:
                    "Something went wrong.",

                details:
                    error.message

            }),
            {
                status: 500,

                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );

    }
};

export const config = {
    path: "/api/search"
};
