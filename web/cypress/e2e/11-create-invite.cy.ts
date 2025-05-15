describe("Create Invite", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });

  it("Creates invite", () => {
    cy.clickFirstGuild();
    cy.get("#guild-container").click();

    cy.get("#invite-dropdown-button").click();

    cy.get("#invite-users-send-input")
      .invoke("val")
      .should(
        "match",
        /^(http|https):\/\/[a-zA-Z0-9.-]+(:\d+)?\/join-guild\/[a-zA-Z0-9]{8}$/
      );
  });
});
