import { expect, test } from "@playwright/test";
import { mockFireroad, seedReturningVisitor } from "./support/app";

/** A program's official page comes from its definition, not its progress. */
test("a program links its official requirements page", async ({
  context,
  page,
}) => {
  await mockFireroad(context);
  await context.route(
    "https://fireroad.mit.edu/requirements/get_json/girs/",
    (route) =>
      route.fulfill({
        json: {
          "list-id": "girs.reql",
          title: "General Institute Requirements",
          url: "https://registrar.mit.edu/gir",
        },
      }),
  );
  await seedReturningVisitor(context);
  await page.goto("/");

  const link = page.getByRole("link", {
    name: /Official .* requirements/,
  });
  await expect(link).toHaveAttribute("href", "https://registrar.mit.edu/gir");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toContainText("(opens in a new tab)");
});
