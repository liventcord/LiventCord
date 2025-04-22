describe("Create Guild", () => {
  before(() => {
    cy.login();
  });
  it("Creates guild", () => {
    cy.get("#create-guild-button").click();
    cy.get("#popOptionButton").click();
    cy.get("#guild-name-input").clear();
    cy.get("#guild-name-input").type("Test Guild");
    cy.wait(300)
    cy.screenshot()
    cy.intercept("POST", "**/api/guilds").as("guildCreateRequest")

    cy.get(".create-guild-verify").click();
    cy.wait(50000)

    cy.wait("@guildCreateRequest").its("response.statusCode").should("eq", 201);
  });
});
