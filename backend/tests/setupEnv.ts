// Runs in every worker before tests. Compose points DATABASE_URL at `db`;
// tests must use `db-test`.
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://adwa:adwa@db-test:5432/adwa_test';
process.env['PAYMENTS_PROVIDER'] = 'fake';
process.env['TICKETS_PROVIDER'] = 'fake';
