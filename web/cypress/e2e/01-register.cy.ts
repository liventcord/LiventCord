describe("Register Test", () => {
  it("Fills out the form and registers", () => {
    cy.visit(Cypress.env('frontendUrl'))
    cy.wait(500)
    cy.get("#register-link").click()
    cy.get("#register-email").type("test@gmail.com")
    cy.get("#register-nick").type("testuser")
    cy.get("#register-pass").type("testt")

    cy.intercept("POST", "**/auth/register").as("registerRequest")

    cy.get("#register-button")
      .should("be.visible")
      .click()

    cy.wait("@registerRequest").then((interception) => {
      expect([200, 409]).to.include(interception.response?.statusCode)
    })
  })
})
