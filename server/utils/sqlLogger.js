const formatSql = (sql) => (sql || "").replace(/\s+/g, " ").trim();

const logSql = (tag, sql, params) => {
  console.log(`[SQL][${tag}]`, formatSql(sql));
  if (params && params.length) {
    console.log(`[SQL][${tag}][PARAMS]`, params);
  }
};

export { logSql };
