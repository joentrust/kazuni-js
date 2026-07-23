import { Kazuni, KazuniError } from "@kazuni/sdk";

const kazuni = new Kazuni(process.env.KAZUNI_API_KEY ?? "");

async function main() {
  try {
    const result = await kazuni.send.email({
      from: "Acme <hello@acme.example>",
      to: "customer@example.com",
      subject: "Welcome to Acme",
      html: "<p>Thanks for signing up.</p>",
      text: "Thanks for signing up.",
    });

    console.log(`Queued email ${result.id} with status "${result.status}"`);
  } catch (error) {
    if (error instanceof KazuniError) {
      console.error(`Kazuni request failed (${error.status ?? "network"}): ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main();
