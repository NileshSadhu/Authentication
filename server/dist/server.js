import dotenv from "dotenv";
dotenv.config();
import { env } from "./config/env.js";
import { app } from "./app.js";
const PORT = env.PORT;
const port = PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
