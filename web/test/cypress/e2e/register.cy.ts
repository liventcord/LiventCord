describe("Register Test", () => {
  it("Fills out the form and registers", () => {
    cy.visit("http://localhost:5005/register");

    cy.get("#email").type("test@gmail.com");
    cy.get("#pass").type("testt");
    cy.get("#nick").type("testuser");

    cy.intercept("POST", "/auth/register").as("registerRequest");

    cy.get('button[type="submit"]').click();

    cy.wait("@registerRequest").its("response.statusCode").should("eq", 200);
  });
});
