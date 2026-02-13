export async function runTextProviders(prompt, env) {
  if (env.AI) {
    try {
      const out = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [{ role: 'user', content: prompt }] });
      return out?.response || out?.result || null;
    } catch {}
  }
  return `تحلیل نمونه:\n${prompt.slice(0, 500)}`;
}

export async function runPolishProviders(text) { return text; }
