let jiraContent = "";

// allow CORS
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// preflight request
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req) {
  const { content } = await req.json();
  jiraContent = content;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function GET() {
  return new Response(JSON.stringify({ content: jiraContent }), {
    status: 200,
    headers: corsHeaders(),
  });
}
