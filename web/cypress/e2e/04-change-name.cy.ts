describe("Change Name Tests", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"));
  });
  it("Change name and apply settings", () => {
    cy.get("#settings-button").click();
    cy.get("#new-nickname-input").clear();
    const testNick = "TestUser-" + Date.now();
    cy.get("#new-nickname-input").type(testNick);
    cy.intercept("PUT", "**/api/nicks").as("nickRequest");

    cy.get("#settings-unsaved-popup-applybutton").click();
    cy.wait("@nickRequest").its("response.statusCode").should("eq", 200);
    cy.get("#self-name").should("have.text", testNick);
  });
});
