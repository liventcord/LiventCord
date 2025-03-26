describe("Delete Channel", () => {
  before(() => {
    cy.login();
  });

  it("Deletes channel", () => {
    cy.clickFirstGuild();
    cy.intercept("DELETE", "/api/guilds/*/channels").as("channelDeleteRequest");

    cy.get("#channelul")
      .children()
      .first()
      .trigger("mouseover")
      .find(".content-wrapper")
      .click();
    cy.get("#settings-leftbar").first().should("be.visible").click();

    cy.get("#settings-leftbar")
      .first()
      .find(".settings-buttons")
      .last()
      .click();
    cy.get(".pop-up-accept").click();

    cy.wait("@channelDeleteRequest")
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("#channel-list")
      .find("ul")
      .children("li.channel-button")
      .should("have.length", 1);
  });
});
