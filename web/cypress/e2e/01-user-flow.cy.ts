describe("Register Test", () => {
  it("Fills out the form and registers", () => {
    cy.visit(Cypress.env("frontendUrl"), {
      onBeforeLoad: (win) => {
        Object.defineProperty(win.navigator, "userAgent", {
          value: Cypress.env("userAgent")
        });
      }
    });

    cy.get("#register-link").click();
    cy.get("#register-email").type("test@gmail.com");
    cy.get("#register-nick").type("testuser");
    cy.get("#register-pass").type("testt");

    cy.intercept("POST", "**/auth/register").as("registerRequest");

    cy.get("#register-button").should("be.visible").click();

    cy.wait("@registerRequest").then((interception) => {
      expect([200, 409]).to.include(interception.response?.statusCode);
    });
  });
});

describe("Change Name Tests", () => {
  before(() => {
    cy.login();
    cy.visit(Cypress.env("frontendUrl"), {
      onBeforeLoad: (win) => {
        Object.defineProperty(win.navigator, "userAgent", {
          value: Cypress.env("userAgent")
        });
      }
    });
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

describe("Check docs uptime", () => {
  it("Requests swagger json", () => {
    cy.request({
      url: Cypress.env("backendUrl") + "/swagger/v1/swagger.json",
      method: "GET"
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
