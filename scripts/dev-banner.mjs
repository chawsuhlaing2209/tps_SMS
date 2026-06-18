console.log(`
SMS dev stack
  Web:    http://localhost:3000
  API:    http://localhost:4000  (required for sign-in)
  Worker: background jobs

Prerequisites: npm run db:up  (Postgres, Redis, MinIO)

Demo school login (http://localhost:3000):
  Tenant: demo-alpha
  Email:  owner@demo-alpha.example.edu.mm
  Password: ChangeMe123!
`);
