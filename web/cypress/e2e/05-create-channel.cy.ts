describe("Create Channel", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Creates channel", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();
    cy.get("#channel-container")
      .find("#channelul")
      .children()
      .as("initialChannelCount");
    cy.get("#channel-dropdown-button").click();
    cy.get("#create-channel-send-input").type("Test channel");

    // Check if channel count is increased after request
    cy.get("@initialChannelCount").then((initialCount) => {
      cy.intercept("POST", "**/api/guilds/*/channels").as(
        "channelCreateRequest"
      );
      cy.get(".pop-up-accept").click();
      cy.wait("@channelCreateRequest")
        .its("response.statusCode")
        .should("eq", 200);
      cy.get("#channel-container")
        .find("#channelul")
        .children()
        .should("have.length.greaterThan", initialCount.length);
    });
  });
});
