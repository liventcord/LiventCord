describe("Login Test", () => {
  it("Fills out the form and logins", () => {
    cy.visit("http://localhost:5005/login");

    cy.get("#email").type("test@gmail.com");
    cy.get("#pass").type("testt");

    cy.get('button[type="submit"]').click();

    cy.url().should("include", "/channels/@me");
  });
});
