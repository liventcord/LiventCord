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
