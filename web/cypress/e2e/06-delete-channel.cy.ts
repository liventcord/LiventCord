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
      .eq(1)
      .trigger("mouseover")
      .find(".content-wrapper")
      .click();

    cy.get("#settings-leftbar")
      .first()
      .find(".settings-buttons")
      .last()
      .click();

    cy.get(".pop-up-accept").click();

    cy.wait("@channelDeleteRequest")
      .its("response.statusCode")
      .should("eq", 200);
  });
});
