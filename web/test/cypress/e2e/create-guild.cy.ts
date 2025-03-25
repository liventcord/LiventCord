describe("Create Guild", () => {
  before(() => {
    cy.login();
  });
  it("Creates guild", () => {
    cy.visit("http://localhost:5005/app");
    cy.get("#create-guild-button").click();
    cy.get("#popOptionButton").click();
    cy.get("#guild-name-input").type("Test Guild");

    cy.intercept("POST", "/api/guilds").as("guildCreateRequest");

    cy.get(".create-guild-verify").click();

    cy.wait("@guildCreateRequest").its("response.statusCode").should("eq", 201);
  });
});
