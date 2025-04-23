describe("Delete Channel", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Deletes channel", () => {
    cy.clickFirstGuild();
    cy.intercept("DELETE", "**/api/guilds/*/channels/*").as(
      "channelDeleteRequest"
    );

    cy.get("#channel-container")
      .find("#channelul")
      .children()
      .first()
      .trigger("mouseover")
      .find(".content-wrapper")
      .click();

    cy.get("#settings-leftbar")
      .first()
      .find(".settings-buttons")
      .last()
      .click();
    cy.get("#channel-container")
      .find("#channelul")
      .children()
      .as("initialChannelCount");

    cy.get(".pop-up-accept").click();

    cy.wait("@channelDeleteRequest")
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("@initialChannelCount").then((initialCount) => {
      // Check if channel count is decreased after request
      cy.get("#channel-container")
        .find("#channelul")
        .children()
        .should("have.length", initialCount.length - 1);
    });
  });
});
