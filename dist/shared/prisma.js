"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
// Create PostgreSQL connection pool with optimized settings
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Return error after 10 seconds if unable to connect
});
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({
    adapter,
    log: [
        {
            emit: 'event',
            level: 'query',
        },
        {
            emit: 'event',
            level: 'error',
        },
        {
            emit: 'event',
            level: 'info',
        },
        {
            emit: 'event',
            level: 'warn',
        },
    ],
});
// prisma.$on('query', (e) => {
//     // console.log("-------------------------------------------")
//     // console.log('Query: ' + e.query);
//     // console.log("-------------------------------------------")
//     // console.log('Params: ' + e.params)
//     // console.log("-------------------------------------------")
//     // console.log('Duration: ' + e.duration + 'ms')
//     // console.log("-------------------------------------------")
// })
// prisma.$on('warn', (e) => {
//     console.log(e)
// })
// prisma.$on('info', (e) => {
//     console.log(e)
// })
// prisma.$on('error', (e) => {
//     console.log(e)
// })
exports.default = prisma;
