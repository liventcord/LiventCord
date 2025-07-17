describe("Delete Guild", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"), {
      onBeforeLoad: (win) => {
        Object.defineProperty(win.navigator, "userAgent", {
          value: Cypress.env("userAgent")
        });
      }
    });
  });

  it("Deletes guild", () => {
    cy.clickFirstGuild();
    cy.get("#guilds-list").children().as("initialGuildCount");
    cy.get("#guild-container").click();
    cy.get("#settings-dropdown-button").click();
    cy.get("#settings-leftbar")
      .first()
      .find(".settings-buttons")
      .last()
      .click();

    cy.intercept("DELETE", "**/api/guilds/*").as("guildDeleteRequest");
    cy.get(".pop-up-accept").click();

    cy.get("@initialGuildCount").then((initialCount) => {
      cy.wait("@guildDeleteRequest")
        .its("response.statusCode")
        .should("eq", 200);

      cy.get("#guilds-list")
        .children()
        .should(($children) => {
          expect($children.length).to.be.at.most(initialCount.length);
        });
    });
  });
});
