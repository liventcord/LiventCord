describe("Change Name Tests", () => {
  before(() => {
    cy.login();
  });
  it("Change name and apply settings", () => {
    cy.get("#settings-button").click();
    cy.get("#new-nickname-input").clear();

    cy.get("#new-nickname-input").type("reeyuki");
    cy.intercept("PUT", "**/api/nicks").as("nickRequest");

    cy.get("#settings-unsaved-popup-applybutton").click();
    cy.wait("@nickRequest").its("response.statusCode").should("eq", 200);
  });
});
