import { J, need, readCfg } from "../../_lib/core.js";
export async function onRequestGet({ request, env }) {
  const [s, err] = await need(request, env, "admin"); if (err) return err;
  return J(await readCfg(env));
}
