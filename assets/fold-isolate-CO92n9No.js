async function o(t,e){for(const a of e)a.op==="put"?await t.put(a.key,a.value):await t.del(a.key)}export{o as applyMutations};
