// scripts/test-login-browser.ts
import puppeteer from "puppeteer";

async function testLoginFlow() {
  console.log("🚀 Starting browser automation test...\n");

  const browser = await puppeteer.launch({
    headless: false, // Show browser window
    defaultViewport: { width: 1280, height: 800 },
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  try {
    // Enable console logging from the page
    page.on("console", (msg) => {
      const type = msg.type();
      if (["error", "warning"].includes(type)) {
        console.log(`[BROWSER ${type.toUpperCase()}]:`, msg.text());
      }
    });

    // Navigate to candidate signin
    console.log("📍 Navigating to candidate signin page...");
    await page.goto("http://localhost:3000/auth/signin?role=CANDIDATE", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("✓ Page loaded\n");

    // Wait for form to be visible
    await page.waitForSelector('input[name="email"]', { timeout: 5000 });
    await page.waitForSelector('input[name="password"]', { timeout: 5000 });

    console.log("📝 Filling in login credentials...");

    // Fill in email
    await page.type('input[name="email"]', "candidate.test@example.com", {
      delay: 50,
    });
    console.log("   ✓ Email: candidate.test@example.com");

    // Fill in password
    await page.type('input[name="password"]', "TestCandidate123!", {
      delay: 50,
    });
    console.log("   ✓ Password: TestCandidate123!");

    // Take screenshot before submit
    await page.screenshot({
      path: "test-screenshots/01-before-login.png",
      fullPage: true,
    });
    console.log("   📸 Screenshot saved: 01-before-login.png\n");

    // Click submit button
    console.log("🔐 Submitting login form...");
    const submitButton = await page.$('button[type="submit"]');
    if (!submitButton) {
      throw new Error("Submit button not found");
    }

    // Click and wait for URL to change (form uses client-side redirect)
    const urlBeforeLogin = page.url();
    await submitButton.click();

    console.log("⏳ Waiting for redirect...");

    // Wait for URL to change from signin page
    await page.waitForFunction(
      (oldUrl) => window.location.href !== oldUrl,
      { timeout: 30000 },
      urlBeforeLogin
    );

    // Wait a bit more for page to settle
    await page.waitForTimeout(1000);

    // Get current URL after login
    const currentUrl = page.url();
    console.log("✓ Login submitted");
    console.log("✓ Redirected to:", currentUrl, "\n");

    // Wait a bit to see the result
    await page.waitForTimeout(2000);

    // Take screenshot after login
    await page.screenshot({
      path: "test-screenshots/02-after-login.png",
      fullPage: true,
    });
    console.log("📸 Screenshot saved: 02-after-login.png\n");

    // Check if we're logged in by looking for session/user indicators
    const pageContent = await page.content();

    if (currentUrl.includes("/jobs") || currentUrl.includes("/profile")) {
      console.log("✅ LOGIN SUCCESSFUL!");
      console.log("   User was redirected to:", currentUrl);

      // Try to find user name or email on the page
      try {
        const userIndicator = await page.$eval(
          'button:has-text("Test Candidate"), [aria-label*="Test"], [title*="Test"]',
          (el) => el.textContent
        );
        if (userIndicator) {
          console.log("   Found user indicator:", userIndicator.trim());
        }
      } catch {
        // User indicator not found, but that's okay
      }
    } else if (currentUrl.includes("/signin")) {
      console.log("❌ LOGIN FAILED");
      console.log("   Still on signin page");

      // Look for error messages
      try {
        const errorMsg = await page.$eval(
          '[role="alert"], .error, .text-red-500, .text-rose-500',
          (el) => el.textContent
        );
        if (errorMsg) {
          console.log("   Error message:", errorMsg.trim());
        }
      } catch {
        console.log("   No error message found");
      }
    } else {
      console.log("⚠️  UNEXPECTED REDIRECT");
      console.log("   Redirected to:", currentUrl);
    }

    console.log("\n🔍 Waiting 5 seconds for you to inspect the page...");
    await page.waitForTimeout(5000);

    // Navigate to profile to verify session
    console.log("\n📍 Testing profile access...");
    await page.goto("http://localhost:3000/profile", {
      waitUntil: "networkidle0",
    });

    const profileUrl = page.url();
    console.log("   Current URL:", profileUrl);

    if (profileUrl.includes("/profile")) {
      console.log("   ✅ Profile accessible (session active)");

      await page.screenshot({
        path: "test-screenshots/03-profile-page.png",
        fullPage: true,
      });
      console.log("   📸 Screenshot saved: 03-profile-page.png");
    } else {
      console.log("   ❌ Redirected away from profile (session issue)");
    }

    console.log("\n⏳ Keeping browser open for 10 more seconds...");
    await page.waitForTimeout(10000);
  } catch (error: any) {
    console.error("\n❌ Test failed with error:");
    console.error("   ", error.message);

    // Take error screenshot
    try {
      await page.screenshot({
        path: "test-screenshots/error.png",
        fullPage: true,
      });
      console.log("   📸 Error screenshot saved: error.png");
    } catch {}
  } finally {
    console.log("\n🏁 Closing browser...");
    await browser.close();
    console.log("✨ Test complete!");
  }
}

// Ensure screenshot directory exists
import { mkdirSync } from "fs";
try {
  mkdirSync("test-screenshots", { recursive: true });
} catch {}

testLoginFlow().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
