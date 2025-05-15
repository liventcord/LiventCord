describe("Change Guild Name Test", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });
  it("Change guild name and apply settings", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();
    cy.get("#settings-dropdown-button").click();

    const testGuild = "TestGuild-" + Date.now();
    cy.get("#guild-overview-name-input").clear();
    cy.get("#guild-overview-name-input").type(testGuild);
    cy.url().then((url) => {
      const id = url.split("/")[4]; // Guild Id

      cy.intercept("PUT", `**/api/guilds/${id}`).as("changeGuildNameRequest");

      cy.get("#settings-unsaved-popup-applybutton").click();
      cy.wait("@changeGuildNameRequest")
        .its("response.statusCode")
        .should("eq", 200);
      cy.get("#guild-name").should("have.text", testGuild);
    });
  });
});
