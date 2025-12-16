// scripts/test-login-simple.ts
// Simpler test that checks for errors
import puppeteer from "puppeteer";

async function testLogin() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
  });

  const page = await browser.newPage();

  // Log all console messages from the page
  page.on("console", (msg) => {
    console.log(`[PAGE ${msg.type()}]:`, msg.text());
  });

  // Log network requests
  page.on("request", (req) => {
    if (req.url().includes("auth") || req.url().includes("api")) {
      console.log(`→ ${req.method()} ${req.url()}`);
    }
  });

  page.on("response", (res) => {
    if (res.url().includes("auth") || res.url().includes("api")) {
      console.log(`← ${res.status()} ${res.url()}`);
    }
  });

  try {
    console.log("🌐 Opening signin page...");
    await page.goto("http://localhost:3000/auth/signin?role=CANDIDATE", {
      waitUntil: "domcontentloaded",
    });

    console.log("⏳ Waiting 2 seconds...");
    await page.waitForTimeout(2000);

    // Fill form
    console.log("📝 Filling form...");
    await page.type('input[name="email"]', "candidate.test@example.com");
    await page.type('input[name="password"]', "TestCandidate123!");

    console.log("⏳ Waiting 1 second before submit...");
    await page.waitForTimeout(1000);

    console.log("🔐 Clicking submit...");
    await page.click('button[type="submit"]');

    console.log("⏳ Waiting 10 seconds to observe...");
    await page.waitForTimeout(10000);

    const finalUrl = page.url();
    console.log("\n✅ Final URL:", finalUrl);

    // Check for any error messages
    const errorElements = await page.$$(".text-red-700, .text-rose-700, [role='alert']");
    if (errorElements.length > 0) {
      console.log("\n❌ Found error messages:");
      for (const el of errorElements) {
        const text = await page.evaluate((e) => e.textContent, el);
        console.log("   -", text?.trim());
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  } finally {
    console.log("\n⏳ Keeping browser open for 30 seconds...");
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

testLogin();
