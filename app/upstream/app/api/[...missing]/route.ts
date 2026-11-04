/** Unknown API paths fail explicitly; no implied integration or execution. */
const missing = () => Response.json({ error: 'API endpoint not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
export const GET = missing;
export const POST = missing;
export const PUT = missing;
export const PATCH = missing;
export const DELETE = missing;
