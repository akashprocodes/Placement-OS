import { execSync } from "child_process";
import path from "path";

export default async function globalSetup() {
  const seedScriptPath = path.resolve(__dirname, "seed_e2e_data.py");
  const backendDir = path.resolve(__dirname, "../../../backend");
  const pythonPath = path.resolve(backendDir, ".venv/bin/python");

  console.log("\n[Playwright globalSetup] Ensuring test database isolation and seeding test records...");
  try {
    execSync(`PYTHONPATH="${backendDir}" "${pythonPath}" "${seedScriptPath}"`, {
      env: {
        ...process.env,
        DATABASE_URL: "postgresql+asyncpg://placement_os:placement_os_dev@localhost:5434/test_placement_os",
      },
      stdio: "inherit",
    });
    console.log("[Playwright globalSetup] Test database verification and seeding complete.\n");
  } catch (err) {
    console.error("[Playwright globalSetup] Failed to seed test database:", err);
    throw err;
  }
}

