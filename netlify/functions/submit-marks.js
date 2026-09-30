
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { email, marks } = JSON.parse(event.body || "{}");

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof marks !== "string" ||
      !marks.trim() ||
      marks.trim().length > 100
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email or marks" })
      };
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Email service is not configured" })
      };
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "CAT Marks <onboarding@resend.dev>",
        to: ["lunzalueugene@gmail.com"],
        subject: "New CAT Marks Submission",
        text:
          `Student email: ${email.trim()}\n` +
          `CAT marks: ${marks.trim()}`
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend error:", error);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Email delivery failed" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "CAT marks submitted successfully."
      })
    };
  } catch (error) {
    console.error("Submission error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Submission failed" })
    };
  }
};
