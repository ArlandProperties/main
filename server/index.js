import { openDatabase } from "./db.js";
import { createApp } from "./app.js";
const db = await openDatabase();
const app = createApp(db);
const server = app.listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
  console.log("Arcland server ready"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
