import postgres from "postgres";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "";

    const sql = postgres(env.HYPERDRIVE.connectionString, { prepare: false });

    try {
      await sql`
        INSERT INTO hits (ip, timestamp, count)
        VALUES (${ip}, now(), 1)
      `;
      return new Response("Logged", { status: 200 });
    } catch (err) {
      console.error("DB error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
