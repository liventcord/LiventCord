// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add("login", () => {
  const email = "test@gmail.com";
  const password = "testt";
  cy.visit("http://localhost:5005/login");
  cy.get("#email").type(email);
  cy.get("#pass").type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should("include", "/channels/@me");
  cy.get("#loading-screen").should("not.be.visible");
});

Cypress.Commands.add("clickFirstGuild", () => {
  cy.get("#guilds-list .guild-image").should("have.length.greaterThan", 1);
  cy.get("#guilds-list .guild-image").first().click();
});
