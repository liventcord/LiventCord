describe("Login Test", () => {
  it("Fills out the form and logs in", () => {
    cy.visit("http://localhost:5173/LiventCord/app/");

    cy.get("#login-email").type("test@gmail.com");
    cy.get("#login-pass").type("testt");

    cy.intercept("POST", "**/auth/login").as("loginRequest");
    
    cy.get('#login-button')
    .should('be.visible')
    .click();
  

    cy.wait("@loginRequest").its("response.statusCode").should("eq", 200);
  });
});
