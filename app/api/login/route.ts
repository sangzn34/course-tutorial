export async function GET(request: Request) {
  // For example, fetch data from your DB here
  const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  return new Response(JSON.stringify(users), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request) {
  // Parse the request body
  const body = (await request.json()) as { username: string; password: string };
  const { username, password } = body;

  console.log("Received login data:", { username, password });

  // mock wait 1000ms
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // e.g. Insert new user into your DB

  return new Response(JSON.stringify({ message: "Login successful" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
