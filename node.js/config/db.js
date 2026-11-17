const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL: configurá la cadena de conexión PostgreSQL de Supabase.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

function prepararSQL(sql) {
    let indice = 0;
    let convertido = sql.replace(/\?/g, () => `$${++indice}`);
    if (/^\s*INSERT\s+INTO/i.test(convertido) && !/\bRETURNING\b/i.test(convertido)) {
        convertido = convertido.replace(/;\s*$/, '') + ' RETURNING id';
    }
    return convertido;
}

function resultadoCompatible(result, esSelect) {
    if (esSelect) return [result.rows, result.fields];
    return [{
        affectedRows: result.rowCount,
        insertId: result.rows?.[0]?.id ?? undefined,
        rowCount: result.rowCount,
        rows: result.rows
    }, result.fields];
}

async function ejecutar(client, sql, params = []) {
    const esSelect = /^\s*(SELECT|WITH)\b/i.test(sql);
    const result = await client.query(prepararSQL(sql), params);
    return resultadoCompatible(result, esSelect);
}

const db = {
    query(sql, params = []) {
        return ejecutar(pool, sql, params);
    },
    async getConnection() {
        const client = await pool.connect();
        return {
            query: (sql, params = []) => ejecutar(client, sql, params),
            beginTransaction: () => client.query('BEGIN'),
            commit: () => client.query('COMMIT'),
            rollback: () => client.query('ROLLBACK'),
            release: () => client.release()
        };
    },
    pool
};

module.exports = db;
