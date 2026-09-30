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
marks.trim().length === 0 ||
marks.trim().length > 100
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid email or marks" })
      };
    }

    // Email delivery will be configured securely in the next step.
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Valid submission received"
      })
    };
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid submission" })
    };
  }
};
