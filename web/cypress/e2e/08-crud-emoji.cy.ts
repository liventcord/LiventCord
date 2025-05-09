describe("Create, edit and delete emoji", () => {
  before(() => {
      cy.login();
      cy.visit(Cypress.env("frontendUrl"));
  });

  it("Create, edit and delete emoji", () => {
      cy.clickFirstGuild();
      cy.get("#guild-container").click();
      cy.get("#settings-dropdown-button").click();
      cy.get("#Emoji").click();

      cy.intercept("POST", `**/api/guilds/emojis`).as("uploadEmojiRequest");

      cy.get("#emoji-table-body")
          .children()
          .then((rowsBefore) => {
              const initialCount = rowsBefore.length;
            // Upload emoji
              cy.get("#upload-emoji-button").click();
              cy.get("#emoijImage")
                  .selectFile(`cypress/fixtures/emoji.jpg`, { force: true });

              cy.wait("@uploadEmojiRequest").its("response.statusCode").should("eq", 200);

              cy.get("#emoji-table-body")
                  .children()
                  .should("have.length.greaterThan", initialCount);
              
              cy.get(".pop-up-accept").click();
            cy.intercept("PUT", `**/api/guilds/*/emojis/*`).as("editEmojiRequest");

            // Edit emoji
            cy.get("#emoji-table-body")
              .find("tr")
              .last()
              .find("textarea")
              .clear()
              .type(`emoji_${Date.now()}`, { force: true });

            cy.wait(1000);

            cy.wait("@editEmojiRequest")
              .its("response.statusCode")
              .should("eq", 200);


              // Delete emoji
              cy.intercept("DELETE", `**/api/guilds/*/emojis/*`).as("deleteEmojiRequest");

              cy.get("#emoji-table-body")
              .find("tr")
              .last()
              .find(".emoji-delete-button")
              .click();

              cy.wait("@deleteEmojiRequest").its("response.statusCode").should("eq", 200);

              cy.get("#emoji-table-body")
                  .children()
                  .should("have.length", initialCount);
          });
  });
});