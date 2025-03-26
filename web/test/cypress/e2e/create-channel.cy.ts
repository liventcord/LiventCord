describe("Create Channel", () => {
  before(() => {
    cy.login();
  });

  it("Creates channel", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();
    cy.get("#channel-dropdown-button").click();
    cy.get("#create-channel-send-input").type("Test channel");

    cy.intercept("POST", "/api/guilds/*/channels").as("channelCreateRequest");
    cy.wait(500);

    cy.get(".pop-up-accept").click();

    cy.wait("@channelCreateRequest")
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("#channel-list ul").children().should("have.length", 2);
  });
});
